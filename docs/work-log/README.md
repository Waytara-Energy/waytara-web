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

Every morning around 07:40 a scheduled task (`daily-work-log-excel`) runs `sync` and then `scripts/update-work-log-excel.ps1`, which adds a sheet for every finished day (every date before today) that the shared workbook does not have yet. The shared workbook is `C:\Users\Admin\OneDrive - Waytara Energy LLP\1-Worklogs\work-log-all-days-2026-11-11.xlsx`; the script uses Excel itself, so a person's own edits and formatting in it are kept, a day that already has a sheet is never touched, and nothing is deleted. Nothing is e-mailed any more (the all-days e-mail of 2026-11-11 was sent by hand; copies are in `sent/`, not in git). The two read-only commands the script uses are `python scripts/work_log.py days` and `python scripts/work_log.py day --date YYYY-MM-DD` (JSON).

To run it by hand: `python scripts/work_log.py sync`, then `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\update-work-log-excel.ps1` (add `-Path some.xlsx -Today YYYY-MM-DD` to try it on a copy).
