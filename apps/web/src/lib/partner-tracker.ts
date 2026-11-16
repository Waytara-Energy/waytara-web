// What the applicant sees on their tracking page: four steps, which one they are on, and what we say about it. Pure, so the wording is tested; the page only draws it.
// The statuses are the ones the admins set (PARTNER_STATUSES in apps/admin): new, in_review, shortlisted, onboarding, verification, approved, rejected.

export interface TrackerStep {
  id: "received" | "review" | "onboarding" | "verification";
  title: string;
  sub: string;
  state: "done" | "current" | "todo";
}

export type TrackerStage = "review" | "onboarding" | "verification" | "approved" | "closed";

export interface TrackerView {
  stage: TrackerStage;
  steps: TrackerStep[];
  /** The step number shown on a phone ("Step 2 of 4"), 1 to 4; 4 when finished. */
  position: number;
  headline: string;
  body: string;
}

const STEPS: Omit<TrackerStep, "state">[] = [
  { id: "received", title: "Application received", sub: "We have your details" },
  { id: "review", title: "Review", sub: "We look at your business and call you" },
  { id: "onboarding", title: "Onboarding", sub: "Your business details and documents" },
  { id: "verification", title: "Verification", sub: "We check, then decide" },
];

/** The step a status belongs to, as an index into STEPS (the received step is always done). */
function currentIndex(status: string): number {
  switch (status) {
    case "shortlisted":
    case "onboarding":
      return 2;
    case "verification":
      return 3;
    default:
      return 1; // new, in_review, and anything unknown
  }
}

const COPY: Record<TrackerStage, { headline: string; body: string }> = {
  review: {
    headline: "We are reviewing your application",
    body: "Our partnerships team will look at your business, your area and your experience, and call you on the number you gave us. You do not need to do anything now.",
  },
  onboarding: {
    headline: "You are shortlisted",
    body: "Next we will ask for your business details, licences, team and documents here. We will e-mail you when that opens.",
  },
  verification: {
    headline: "We are checking your details",
    body: "We are checking what you have sent us, including with the authorities that issued your licences and certificates. We will tell you the outcome here and by e-mail.",
  },
  approved: {
    headline: "You are approved",
    body: "Welcome to the WayTara Partner Network. The last step is to choose a password, which opens your partner area.",
  },
  closed: {
    headline: "Your application was not taken forward",
    body: "Thank you for your interest in the WayTara Partner Network.",
  },
};

/** The words once the onboarding forms are open. */
const OPEN = {
  headline: "Tell us about your business",
  body: "Fill in the parts below and send us your documents. We save as you go, so you can close this page and come back to the same link whenever you like.",
};

export function trackerFor(status: string): TrackerView {
  if (status === "approved") {
    return { stage: "approved", steps: STEPS.map((s) => ({ ...s, state: "done" as const })), position: 4, ...COPY.approved };
  }
  if (status === "rejected") {
    // Nothing is current any more: the steps it had reached stay ticked and the rest are left empty.
    return { stage: "closed", steps: STEPS.map((s, i) => ({ ...s, state: i <= 1 ? ("done" as const) : ("todo" as const) })), position: 2, ...COPY.closed };
  }
  const at = currentIndex(status);
  const stage: TrackerStage = at === 2 ? "onboarding" : at === 3 ? "verification" : "review";
  return {
    stage,
    steps: STEPS.map((s, i) => ({ ...s, state: i < at ? ("done" as const) : i === at ? ("current" as const) : ("todo" as const) })),
    position: at + 1,
    // Shortlisted waits for the team to open the forms; once they are open (status onboarding) the page is the forms.
    ...(status === "onboarding" ? OPEN : COPY[stage]),
  };
}
