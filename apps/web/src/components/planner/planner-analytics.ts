import { track } from "@vercel/analytics";

/** The planner's funnel events (docs/WEBSITE_PLAN.md section 8). Never throws: analytics must not break the planner. */
export type PlannerEvent =
  | "planner_route_selected"
  | "ems_interest_selected"
  | "cpms_interest_selected"
  | "segment_page_opened"
  | "compatibility_check_requested"
  | "blueprint_cta_clicked"
  | "planner_enquiry_sent";

export function trackPlanner(event: PlannerEvent, props?: Record<string, string | number | boolean>): void {
  try {
    track(event, props);
  } catch {
    // ignore: a blocked or missing analytics script is fine
  }
}
