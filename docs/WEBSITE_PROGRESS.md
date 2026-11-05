# Website redesign: progress and working hours

Times are IST. "Start" and "End" are logged by Claude when a task begins and when its commit lands. "Hours" is end minus start, so it includes review waits only if a task stays open across them (noted in the row). The estimate column is a planning guess, not a promise.

## Task list (follows the build order in WEBSITE_PLAN.md section 12)

| # | Task | Status | Start | End | Hours | Est. h | Commit | Notes |
|---|------|--------|-------|-----|-------|--------|--------|-------|
| 0a | Landing hero: cloud shader sky, house cut-out, pinned scroll scene, wider container, bigger headline | Done | 2026-11-05 (start not logged) | 2026-11-05 11:09 | not logged | - | fed1b74, 18cf5d3, f40ccd6 | Built before this tracker existed. Commits landed 10:57 to 11:09; real start time is yours to fill. |
| 0b | Read 14 PDFs and write the website plan | Done | 2026-11-05 (start not logged) | 2026-11-05 11:23 | not logged | - | 1e9999c | docs/WEBSITE_PLAN.md |
| 1 | Foundation: header (Solutions menu, Platform, Why WayTara, About Us, Contact, theme, Get Started), footer, shared section components | Not started | | | | 3 to 4 | | Needs plan decisions 1 and 2. |
| 2 | Landing page sections 2 to 9 (The idea, What WayTara does, One dashboard, Who we serve, How a project works, Where to start, Why strip, Final CTA) | Not started | | | | 6 to 8 | | Needs plan decision 5. |
| 3 | Solutions hub + Homes & Villas page (reference for the template) | Not started | | | | 4 to 5 | | Needs plan decisions 3 and 4. |
| 4 | Other five segment pages (Apartments, Commercial, Factory, EV Fleets, IT Parks) | Not started | | | | 5 to 6 | | |
| 5 | Energy Planner v3 and enquiry changes (leads API and DB change: ask first) | Not started | | | | 8 to 10 | | Live Supabase write needs your OK. |
| 6 | Why WayTara, About Us, Platform pages | Not started | | | | 4 to 5 | | |
| 7 | Clean-up: retire old packages UI and planner, redirects, sitemap, metadata, structured data | Not started | | | | 2 to 3 | | |

Total estimate for steps 1 to 7: about 32 to 41 hours. Customer dashboard redesign comes after the landing page and is not in this table yet.

## Log

| Date | Time (IST) | Event |
|------|-----------|-------|
| 2026-11-05 | 12:28 | Tracker created. Waiting for decisions 1 to 5 before step 1. |
