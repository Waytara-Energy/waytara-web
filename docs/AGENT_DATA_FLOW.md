# Equipment agent: what it reads, what it writes, and how often

The agent is the program that sits next to a customer's inverter (or EV charger), reads it, and sends the results to Supabase.
This page describes exactly which tables it touches, what goes into them, and on what schedule, including the **heartbeat**
that tells the dashboard whether a device is alive.

*Written 2026-10-12 from the agent's source and the database migrations, with live row counts for the Deye 8 kW inverter
`b4c30eb8-fba4-4487-aa7a-3c1b089e36e2`. Numbers marked "(live)" are a snapshot and will move.*

| | |
|---|---|
| Real agent | Python package `equipment_agent`, in `D:/Manoj-Waytara/inverter script/` (not in this repo). Start with `python -m equipment_agent`. |
| Its own notes | `EQUIPMENT_AGENT.md` next to it (some defaults there are out of date; see "Known gaps"). |
| Not the real agent | `packages/supabase/scripts/deye-modbus-agent.mjs` is a **demo simulator** only. Its `--mode=modbus` is disabled. |
| Protocols | Modbus TCP for inverters, OCPP 1.6J for EV chargers (the agent is the OCPP central system). |
| Database schema | `waytara` |

## 1. The picture

```
 inverter ──Modbus──►  agent  ──► local copy of every reading (jsonl, 14 days)         [this PC only]
                         │
                         ├─ every upload interval ─► RPC waytara.ingest_tick ─► equipment_latest
                         │                                                      equipment_open_bucket
                         │                                                      equipment_rollup_15m
                         │                                                      equipment_heartbeat  (+ a live "tick")
                         │
                         ├─ every HEARTBEAT_S ─────► the same RPC, empty values (the check-in)
                         │
                         ├─ start-up and after a change request ─► INSERT equipment_configs
                         │
                         └─ while a customer watches "Go live" ─► Realtime channel live:<id> + Storage live-snapshots

 Supabase ──Realtime──► agent:  equipment_configs INSERT (a setting was requested)
                                equipment_metrics change (re-read the metric list)
```

**Raw readings are never uploaded.** `equipment_telemetry` has 0 rows for this device. Only 15-minute aggregates, the latest
values and the check-in go up; the raw copy stays on the agent's machine.

## 2. What it reads from Supabase

| Table | Columns used | When |
|---|---|---|
| `customers` (+ `profiles`) | id, status, full name, e-mail | Start-up, for the customer picker |
| `equipment` (+ `equipment_inventory`) | id, label, category, brand, model, model number, technical specs | Start-up, for the device picker |
| `equipment_metrics` (+ `equipment_templates`) | key, register address, decode rules, direction (`read`/`write`), `cadence_seconds`, valid min and max, `show_for_user`, unit, display name, value kind | Start-up, then again whenever a row changes (Realtime, with a short debounce) |
| `equipment_enum` | enum_ref, code, label | Start-up |
| `equipment_configs` | latest value per setting | Start-up, only to fill `previous_value` and to notice a difference |

It also **listens** (Supabase Realtime, re-subscribes with back-off if the channel drops) to:

| Table | Event | What it does |
|---|---|---|
| `equipment_configs` | INSERT for this device | Treats a row whose source is not `agent_*` as a request to change a setting |
| `equipment_metrics` | INSERT, UPDATE, DELETE | Reloads the metric list without a restart |

## 3. What it writes to Supabase

### 3.1 One RPC, `waytara.ingest_tick`

Every upload and every check-in is one call to `ingest_tick(p_equipment_id, p_ts, p_values, p_open, p_closed, p_agent)`. It is
idempotent (a retry after a lost reply is safe), never trusts a clock that runs ahead (`ts` is capped at the server's `now()`),
and writes:

| Table | What goes in | Rule | Size for this device (live) |
|---|---|---|---|
| `equipment_latest` | newest value and unit per key (`value`, `unit`, `ts`) | Upsert; only values **read since they were last sent** (a value that was not read again is never re-sent, so a dead device cannot look fresh). A full refresh of every value goes up every 15 min. Newer `ts` wins. | 97 keys |
| `equipment_open_bucket` | running figures of the current 15-minute bucket: weighted sum, covered seconds, min, max, last, positive and negative parts, sample count | Upsert, at most once a minute; a newer bucket replaces an older one | 97 rows |
| `equipment_rollup_15m` | each **finished** 15-minute bucket per key: same figures plus `is_test` | Insert or update only if `covered_s` is larger. Rejected if not aligned to 15 minutes, older than 8 days, or in the future. Daily partitions, **kept 8 days**. | about 9,200 rows a day (95 buckets x 97 keys) |
| `equipment_heartbeat` | one row per device: `last_seen`, `agent_ts`, `upload_interval_s`, `heartbeat_s`, `agent_version`, `device_online`, `last_read_at`, `device_error` | Upsert (see section 5) | 1 row |
| Realtime message | one `tick` per upload on the private channel `device:<equipment_id>` with the new values, open bucket and agent state | Sent when there are values, an open bucket, or a device state; never fails the ingest; skipped if over 200 KB | per upload |

Buckets are **time-weighted** (sample and hold): a reading holds from its timestamp until the next one of the same key, no
longer than `min(7200, max(60, 2 x cadence))` seconds. Offline gaps are *not* covered, so a gap shows as a gap, never as zeros.
All buckets are aligned to the IST clock.

**Finished buckets are never lost.** They are queued in `output/state/unsent_buckets_<id>.jsonl` until Supabase confirms them
(up to 50,000, about five days). A failed upload retries after 15, 30, 60 and 120 s, and a check-in that works again sends the
whole backlog (1,500 buckets per call).

### 3.2 Direct inserts into `equipment_configs`

`equipment_configs` is an **append-only log** of settings. Each row: `equipment_id`, `ts`, `setting_category`, `key_name`,
`setting_value` (text), `previous_value`, `unit`, `source`, `written_by`, `notes`, `modbus_register`.

| `source` | Written by | When | Value |
|---|---|---|---|
| `agent_initial_read` | agent | Start-up: every write register read from the inverter (66 write metrics; 62 answer) | what the device holds. Bools as `1`/`0`; times as digits (`100` = 01:00). |
| `agent_write_ok` | agent | After a requested change was written **and read back** and the read-back matched | the read-back value |
| `agent_write_failed` | agent | After a requested change failed or did not stick | what the device still holds; the request goes in `previous_value`; the reason in `notes` |
| `customer_dashboard` | the web app | A customer changed a setting | the requested value (`true`/`false` for on/off; digits for a time) |

How the agent handles a request: it ignores its own `agent_*` rows, checks the key is a writable, customer-visible metric,
checks the range, then writes. A setting that shares a register with others (the Time-of-Use switches, beep and screen-dim) is
written with a **read-modify-write of just its bits**. It reads the value back and records the result. It accepts `1`, `true`,
`on` and plain numbers, but **not** "HH:MM".

**One case writes nothing:** if a write fails *and* the register cannot be read back (inverter or adapter unreachable), the
agent logs a warning and writes no row (`agent.py` lines 640 to 645). The dashboard then shows the change as "waiting for the
inverter" until an answer arrives.

### 3.3 Go Live (only while a customer is watching)

| Where | What |
|---|---|
| Realtime channel `live:<equipment_id>` | Presence (viewers announce which keys they want), then broadcasts: `snapshot` (path, session, time range, keys), `tick` (new readings), `bye` |
| Storage bucket `live-snapshots` | `<equipment_id>/<session>.json.gz`: today's readings for the asked-for keys, uploaded when a viewer joins and **deleted** when the stream ends |

Nothing here is written to a table. The agent stays on the channel all the time and streams only while someone is watching.

### 3.4 Kept on the agent's machine only

| What | Where | Retention |
|---|---|---|
| Every reading at its own cadence | `output/live/<equipment_id>/YYYY-MM-DD.jsonl` (older days gzipped) | 14 days |
| The metric list used for polling | `output/metrics_<equipment_id>.json` | rewritten at start-up and on a metric change |
| The unsent-bucket queue and roll-up state | `output/state/` | until confirmed |
| Logs | `logs/agent_<ts>.log` (everything) and `logs/errors_<ts>.log` (errors with tracebacks) | not deleted by the agent |
| Optional Excel workbooks | `output/` | on request |

## 4. How often (summary)

| What | Frequency |
|---|---|
| Reading the device | Each metric at its own `cadence_seconds` (this device uses 5, 10, 30, 300, 900, 3600 and 86400 s; **60 s** if a metric has none) |
| Settings read | **Once at start-up** (retried until the device answers). Not again. |
| Upload of changed values, open bucket, finished buckets | Every **upload interval**, on the wall clock: 15 min gives :00, :15, :30, :45, each two seconds after the boundary. **This device: 900 s.** The interval is chosen at start-up (5 s to 1 h) and does not change how often the inverter is read. |
| Open bucket | At most once a minute |
| Every live value re-sent | Every 15 minutes (900 s) |
| **Heartbeat** | Every `HEARTBEAT_S` seconds, **default 10** (see section 5) |
| Fault or alarm register changes (`fault_message_*`, `alarm_status_*`) | Uploaded at once |
| Device starts or stops answering | Uploaded at once |
| Change request from the dashboard | Handled as soon as the Realtime row arrives |
| Metric list reload | When `equipment_metrics` changes (debounced) |
| Go Live | While at least one viewer is on the channel |

**Inside the database** (not the agent):

| Job | Frequency | What it does |
|---|---|---|
| `rollup-run` (pg_cron) | every 5 min | Builds `equipment_rollup_1h` from 15-minute rows, and `equipment_rollup_1d` from hourly rows |
| `device-status` (pg_cron) | every 10 s | Applies the "silence" half of the device status (section 5) |
| `detect-alerts` (pg_cron calls a web route) | every 5 min | Raises fault, alarm and offline alerts and e-mails the customer |

Retention: `equipment_rollup_15m` **8 days**; `equipment_rollup_1h` and `equipment_rollup_1d` **kept forever**; `equipment_latest`
holds one row per key.

## 5. The heartbeat

### What it is

The server cannot reach a device (it sits behind the customer's router), so the device **checks in** and the server judges
the silence. A check-in is the same `ingest_tick` call with **no values**, carrying only the agent's own state. It is both "I
am alive" and "this is how my link to the inverter is doing".

### What the agent sends

Every `HEARTBEAT_S` seconds (environment variable, **default 10**; `0` switches it off), the agent calls
`ingest_tick(p_values = {}, p_open = {}, p_closed = [], p_agent = ...)`.

| `p_agent` field | Meaning |
|---|---|
| `interval_s` | the upload interval (900 here) |
| `heartbeat_s` | the check-in interval |
| `version` | agent version, for example `equipment_agent 2026.10-rollup` |
| `device_online` | did the **inverter** answer the agent's last readings (true/false); left out until known |
| `last_read_at` | when the inverter last really answered (the agent's clock) |
| `device_error` | only while `device_online` is false: the agent's own words for why (for example "could not open a TCP connection to 192.168.29.200:502" means the adapter is off or off the network; a timeout means the adapter answers but the inverter does not). At most 300 characters. |

Rules: a check-in is skipped if anything was uploaded in the last half interval (that upload was already a check-in); it never
touches the bucket queue; a failed check-in is only logged at debug level and is simply repeated.

### What the server does with it

`equipment_heartbeat` holds one row per device. Each call updates:

| Column | Set to |
|---|---|
| `last_seen` | the **server's** clock at arrival (never the agent's or the browser's) |
| `agent_ts` | the agent's own timestamp |
| `upload_interval_s`, `heartbeat_s`, `agent_version` | what the agent said (kept if not sent) |
| `device_online` | what the agent said |
| `last_read_at` | the newer of the stored and the new value |
| `device_error` | kept while the device stays unreachable, cleared when it answers |
| `consecutive_failures` | check-ins in a row with `device_online = false`; back to 0 when it answers |
| `status`, `status_since`, `status_reason` | the verdict below |

**The verdict** (`waytara.device_status_of`, view `waytara.equipment_status`):

| Status | When | Dashboard |
|---|---|---|
| `never_seen` | no check-in yet | treated as offline |
| `offline` | no check-in for `offline_after_s` = **max(30 s, 3 x heartbeat_s)** (falls back to the upload interval, then 60 s). The unit lost power, Wi-Fi or internet. | red; "Offline" |
| `device_unreachable` | the unit checks in, but the inverter has failed **3 check-ins in a row** | amber; "Connection lost"; `status_reason` carries `device_error` |
| `online` | checking in, and the inverter answers | green |

With the default 10 s heartbeat a unit is called offline after **30 s** of silence. A check-in updates the status **at once** (a
trigger), so a device is green the moment it reports. A job, `device-status`, runs every 10 s for the other direction (silence
with no check-in to cause the change). Every status change is broadcast on the device's live channel, so open dashboards
update without asking.

### What it drives

| Where | Effect |
|---|---|
| Header device icons, the Devices page picture glow, the Maintenance "System health" and "Connection" check | Colour and wording from the status; "last reading" from `last_read_at` |
| Dashboard numbers | A device that is not online shows its last readings, not a fresh-looking time; Go Live is disabled |
| Offline toast with "Investigate" | Shown on every dashboard page while the device is offline or unreachable; comes back every 3 hours until it recovers |
| `detect-alerts` (every 5 min) | Raises an offline alert when the agent says the device does not answer, or the agent itself has been quiet for **max(10 min, 3 check-in intervals)**; e-mails the customer; sends a reminder every 3 hours until acknowledged or resolved |

### What it looks like for this device (live)

`upload_interval_s` 900 and agent version `equipment_agent 2026.10-rollup`. `last_seen`, `device_online` and the status change
every few seconds, so read them with the query in section 7 instead of trusting a number written here.

## 6. Known gaps (as of 2026-10-12)

1. **Settings are read once, at start-up.** A change made on the inverter's own screen, by an installer or by another app, stays
   invisible until the agent restarts. A periodic re-read would fix it.
2. **Two dashboard changes are unanswered.** `time_of_use_sunday_enabled` was set to false (10 Oct 15:13 IST) and back to true
   (11 Oct 00:27 IST). There is no `agent_write_ok` or `agent_write_failed` row for either, so the dashboard shows them as
   waiting. The agent that is live is **not** on the development PC (no Python process; the local `logs/` folder is empty and
   `output/state` has not changed since 9 Oct 17:35), so its logs are needed: look in `logs/agent_*.log` and `errors_*.log` on
   the machine that runs it, around those times, for "Write request". One by-design cause: the write failed and could not be read back (section 3.2).
3. **Out-of-date notes.** `EQUIPMENT_AGENT.md` says the heartbeat default is 60 s; the code says 10 s (`agent.py` line 38). The comment
   at the top of `register-codec.mjs` (demo script) says no write setting uses a bit mask; about 20 now do. The Python agent
   handles them correctly; the demo script does not.
4. **The agent's clock matters.** Buckets are cut by the agent PC's clock. `ingest_tick` returns `skew_s`; a skew over 5 s is
   logged as a warning ("please sync Windows time").

## 7. Checking it yourself

```sql
-- Is the agent checking in, and what is the verdict?
select status, status_reason, last_seen, last_read_at, upload_interval_s, heartbeat_s, device_online, device_error, consecutive_failures
from waytara.equipment_status where equipment_id = '<equipment id>';

-- How much has it written in the last day?
select count(*) rows, count(distinct bucket) buckets, count(distinct key_name) keys
from waytara.equipment_rollup_15m where equipment_id = '<equipment id>' and bucket > now() - interval '24 hours';

-- What did settings requests turn into? (a request should be followed by agent_write_ok or agent_write_failed)
select ts at time zone 'Asia/Kolkata' as ist, key_name, setting_value, previous_value, source, notes
from waytara.equipment_configs where equipment_id = '<equipment id>' and source <> 'agent_initial_read' order by ts;
```
