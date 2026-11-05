# Website redesign: progress and working hours

Times are IST. "Start" and "End" are logged by Claude when a task begins and when its commit lands. "Hours" is end minus start, so it includes review waits only if a task stays open across them (noted in the row). The estimate column is a planning guess, not a promise.

## Task list (follows the build order in WEBSITE_PLAN.md section 12)

| # | Task | Status | Start | End | Hours | Est. h | Commit | Notes |
|---|------|--------|-------|-----|-------|--------|--------|-------|
| 0a | Landing hero: cloud shader sky, house cut-out, pinned scroll scene, wider container, bigger headline | Done | 2026-11-05 (start not logged) | 2026-11-05 11:09 | not logged | - | fed1b74, 18cf5d3, f40ccd6 | Built before this tracker existed. Commits landed 10:57 to 11:09; real start time is yours to fill. |
| 0b | Read 14 PDFs and write the website plan | Done | 2026-11-05 (start not logged) | 2026-11-05 11:23 | not logged | - | 1e9999c | docs/WEBSITE_PLAN.md |
| 1 | Foundation: header (Solutions menu, Platform, Why WayTara, About Us, Partner, Contact, theme, Get Started), footer, shared section components | Done (pending your review) | 2026-11-05 12:36 | 2026-11-05 12:46 | 0.2 | 3 to 4 | (next commit) | Decisions 1 and 2 settled: Platform in the header, Get Started goes to /planner. Clock time only; your review time is not counted. Header links to /planner, /why-waytara, /partner and /solutions#build etc. lead to pages built in later tasks, so do not push or deploy before those exist. |
| 2 | Landing page sections 2 to 9 (The idea, What WayTara does, One dashboard, Who we serve, How a project works, Where to start, Why strip, Final CTA) | Not started | | | | 6 to 8 | | Needs plan decision 5. |
| 3 | Solutions hub + Homes & Villas page (reference for the template) | Not started | | | | 4 to 5 | | Needs plan decisions 3 and 4. |
| 4 | Other five segment pages (Apartments, Commercial, Factory, EV Fleets, IT Parks) | Not started | | | | 5 to 6 | | |
| 5 | Energy Planner v3 and enquiry changes (leads API and DB change: ask first) | Not started | | | | 8 to 10 | | Live Supabase write needs your OK. |
| 6 | Why WayTara, About Us, Platform pages | Not started | | | | 4 to 5 | | |
| 6b | Partner programme: public "Partner with us" page and installer application form, saved to the database, listed in the admin panel, e-mail to the admins | Not started | | | | 8 to 10 | | Added 2026-11-05 at the user's request. New table + RLS = a live Supabase write, so I ask first. See breakdown below. |
| 7 | Clean-up: retire old packages UI and planner, redirects, sitemap, metadata, structured data | Not started | | | | 2 to 3 | | |

Task 6b breakdown (estimate): public page and form 2 to 3 h; database table, access rules and tests 1 to 2 h (needs your OK before it touches the live project); admin list and detail page with status and notes 3 h; admin e-mail notification 1 h; checks 1 h. It reuses what exists: Resend through `apps/web/src/lib/send-mail.ts`, the `LEADS_NOTIFICATION_EMAIL` recipient pattern in `notify-team.ts`, and the admin `leads` page layout.

Total estimate for steps 1 to 7 including 6b: about 40 to 51 hours. Customer dashboard redesign comes after the landing page and is not in this table yet.

## Log

| Date | Time (IST) | Event |
|------|-----------|-------|
| 2026-11-05 | 12:28 | Tracker created. Waiting for decisions 1 to 5 before step 1. |
| 2026-11-05 | 12:40 | Decision 1: Platform stays in the header. New task 6b added: Partner page for installers across India, admin panel list, e-mail to admins. |
| 2026-11-05 | 12:36 | Task 1 started (decision 2 settled: Get Started goes to the planner). |
| 2026-11-05 | 12:46 | Task 1 built and checked: header with Solutions menu, mobile menu, footer, shared section header. Awaiting your review. |
