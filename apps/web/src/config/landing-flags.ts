/**
 * TEMPORARY landing-page flag — requested 2026-09-03 to simplify the
 * public site for now, NOT a permanent product decision. To
 * restore the full landing page, flip this back to `false` (or delete
 * this file and the `TEMP_HIDE_LANDING_SECTIONS` checks that reference
 * it — grep the codebase for the constant name).
 *
 * While `true`:
 *  - Hides the How It Works, Interactive Energy Planner, Compliance &
 *    Leadership (Trust), and FAQ sections on the home page.
 *  - Hides every nav/footer link that points at Knowledge Centre or any
 *    of the sections above (the pages/sections themselves still exist —
 *    only the navigation entry points are removed).
 *  - Hero's primary button becomes "Explore WayTara" (scrolls to Who We
 *    Are) instead of "Plan with Tara AI" (scrolled to the now-hidden
 *    Energy Planner section).
 *  - The Final CTA section shows only "Speak with an Engineer", carrying
 *    the green gradient treatment the removed "Plan with Tara AI" button
 *    used to have.
 */
export const TEMP_HIDE_LANDING_SECTIONS = true;
