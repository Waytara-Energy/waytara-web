# Daily work log

Every piece of work, one row each: **Date | Area | Page / section | Event**.

- `work-log.csv`: the master table (opens in Excel, UTF-8).
- `WORK_LOG.xlsx`: the same rows as a workbook with **one sheet for each day** (oldest first), rebuilt from the CSV.
- `logged-commits.txt`: which commits are already in the log (so a commit is never logged twice).
- Areas: Landing page, Customer dashboard, Admin page, Firmware, Supabase, Backend, Documentation.

The commits are read from git by `scripts/work_log.py sync` (author date, India time); each changed file is placed in an area by its path, and the page or section is named from the file. A commit that touched two areas gives one row in each. Work that is not a commit (a live database change, flashing a board) is added by hand:

```bash
python scripts/work_log.py add --date 2026-11-12 --area Supabase --section "Migration: devices" --event "What was done"
```

Every day around 19:00 a scheduled task runs `sync`, makes that day's workbook (`export --date`) and e-mails it. The first mail (2026-11-11) had every day's sheet; from 2026-11-12 each mail has only that day. Copies of what was sent are kept in `sent/` (not in git).
