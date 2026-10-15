# WayTara unit setup page (task A7)

The page an installer opens on a phone or laptop to set up a monitoring unit: sign in, choose the device the unit is wired to, connect over
Bluetooth, join Wi-Fi, run the connection checks and the speed test, and finish (the unit collects its key from the WayTara server).

Vite + React + TypeScript, no UI library. It talks to two things: Supabase (sign-in, and the list of devices the person may see) and the WayTara
backend (a single-use claim ticket). The unit itself is reached over Web Bluetooth with the encrypted protocol of the firmware
(`waytara-gateway-fw/ble_setup.cpp`); the protocol code is in `src/ble` and is tested against a fake unit.

## Run it

```
pnpm --filter waytara-setup dev        # http://localhost:5174 (localhost counts as a secure page, so Bluetooth works)
pnpm --filter waytara-setup test       # protocol and wording tests
pnpm --filter waytara-setup build      # type check + production build into dist/
```

Copy `.env.example` to `.env.local` first. The three values are public (they end up in the page); none is a secret.

## Browsers

Web Bluetooth works in Chrome and Edge on Android, Windows, macOS, Linux and ChromeOS. It does **not** work in Safari or in any browser on an
iPhone or iPad; the page says so. The address must be `https` (or `localhost`).

## Deploy (Vercel)

1. New project from the dashboard repository, **Root Directory `apps/setup`**, framework Vite (picked up from `vercel.json`).
2. Environment variables (Production and Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GATEWAY_URL`.
3. Add the page's address (origin only, https, no trailing slash) to `ALLOWED_ORIGINS` on the Render service, or the claim ticket call is blocked by the browser.
4. Supabase → Authentication → URL configuration: nothing to add (the page signs in with email and password and does not redirect).

`vercel.json` sets the security headers (strict Content-Security-Policy that allows only this site, the Supabase project and the hub; Bluetooth allowed for
this page only).

## What each step does

| Step | Unit command | Notes |
|---|---|---|
| Device | – | Lists inverters the person can see (the database's access rules decide). |
| Unit | read the info characteristic, key exchange | The unit advertises only while its setup window is open (new unit, or BOOT held 3 s). |
| Wi-Fi | `info`, `scan`, `wifi`, `forget` | 2.4 GHz only. The password goes to the unit over the encrypted link and is never kept by the page. |
| Checks | `checks`, `speed` | Wi-Fi, name lookup, clock, secure connection, server, live link. |
| Finish | `claim` (+ `POST /v1/equipment/{id}/claim-tickets`) | The unit then restarts. |

Known limits: the unit restarts after setup, so the Bluetooth link ends on purpose; a unit that is already set up for another device is replaced
after a warning; iPhones are not supported (Apple does not offer Web Bluetooth).
