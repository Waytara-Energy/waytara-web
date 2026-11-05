import { activeQuestions, goalOptionsFor, resolveOptions, visibleParts } from "./flow";
import type { Answers, Blueprint, PlannerContext } from "./types";

const MAX_LENGTH = 3000;

/**
 * The planner's answers and its recommendation as plain text, for the enquiry that reaches the team: what they wanted, what they have, and what
 * the planner suggested and why. This is the part that makes the enquiry more useful than a name and a phone number.
 */
export function plannerSummary(a: Answers, b: Blueprint, ctx: PlannerContext = {}, entry?: string): string {
  const lines: string[] = [];

  for (const q of activeQuestions(a, ctx)) {
    for (const part of visibleParts(q, a)) {
      const value = a[part.field];
      const picked = Array.isArray(value) ? (value as string[]) : value ? [String(value)] : [];
      if (picked.length === 0) continue;
      const options = part.field === "goals" ? goalOptionsFor(ctx) : resolveOptions(part, a);
      const labels = picked.map((v) => options.find((o) => o.value === v)?.label ?? v);
      lines.push(`${part.label ?? q.title}: ${labels.join("; ")}`);
    }
  }
  // A property known from the page the visitor came from is not asked, so it is added here.
  if (a.property && !lines.some((l) => l.startsWith("Where will this be used?"))) lines.unshift(`Property: ${a.property}`);

  lines.push("");
  lines.push(`Planner recommendation: ${b.headline}`);
  lines.push(`Route: ${b.routeLabel}`);
  if (b.why.length) lines.push(`Why: ${b.why.join(" ")}`);
  if (b.existing.length) lines.push(`Existing equipment: ${b.existing.join(" ")}`);
  if (b.uncertain.length) lines.push(`Still to confirm: ${b.uncertain.join(" ")}`);
  lines.push(`Page: ${b.next.pageHref}`);
  if (entry) lines.push(`Arrived via: ${entry}`);

  const text = lines.join("\n");
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1)}…` : text;
}
