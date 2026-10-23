// The two checklists on the Account tab of Application Settings: how complete the profile is, and how well the account is protected. Pure, so the
// rules are tested.

export type SettingsTab = "account" | "profile" | "appearance" | "units" | "dashboard" | "notifications" | "alerts" | "billing" | "security" | "privacy";

export interface HealthInput {
  hasPhoto: boolean;
  hasName: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
  /** a billing address of its own, a billing e-mail, or a GST number */
  hasBillingDetails: boolean;
  twoFactor: boolean;
  /** the e-mail for new sign-ins is on */
  signInAlerts: boolean;
  /** a time is set after which an idle browser is signed out */
  idleSignOut: boolean;
  devicesSignedIn: number;
  /** how many of the alerts (ready-made and own) are switched on */
  alertsOn: number;
  /** every e-mail of the person is switched off or paused */
  allMailOff: boolean;
}

export interface CheckItem {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  /** the tab where it can be done */
  tab: SettingsTab;
}

export interface Checklist {
  items: CheckItem[];
  done: number;
  total: number;
  percent: number;
}

const checklist = (items: CheckItem[]): Checklist => {
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, percent: items.length === 0 ? 100 : Math.round((done / items.length) * 100) };
};

/** How complete the profile is: photo, name, phone, address, billing details. */
export function profileCompleteness(i: HealthInput): Checklist {
  return checklist([
    { id: "photo", label: "Add a profile photo", hint: "So the team knows who they are talking to", done: i.hasPhoto, tab: "profile" },
    { id: "name", label: "Add your full name", hint: "Shown in the menu and on your tickets", done: i.hasName, tab: "profile" },
    { id: "phone", label: "Add a phone number", hint: "For the installer to reach you", done: i.hasPhone, tab: "profile" },
    { id: "address", label: "Add your address", hint: "Where you live or run your business", done: i.hasAddress, tab: "billing" },
    { id: "billing", label: "Add billing details", hint: "A billing e-mail or a GST number for your bills", done: i.hasBillingDetails, tab: "billing" },
  ]);
}

export type SecurityLevel = "strong" | "good" | "fair" | "weak";

export interface SecurityScore {
  /** 0 to 100 */
  score: number;
  level: SecurityLevel;
  items: CheckItem[];
}

/** How well the account is protected. The weights say what matters most: the second factor, then knowing about new sign-ins. */
export function securityScore(i: HealthInput): SecurityScore {
  const parts: { weight: number; item: CheckItem }[] = [
    { weight: 20, item: { id: "email", label: "E-mail address verified", hint: "You sign in with a verified address", done: true, tab: "profile" } },
    { weight: 35, item: { id: "2fa", label: "Two-factor sign-in", hint: "A code from your phone as well as the password", done: i.twoFactor, tab: "security" } },
    { weight: 20, item: { id: "signin-mail", label: "E-mail about new sign-ins", hint: "Know at once if someone else gets in", done: i.signInAlerts, tab: "notifications" } },
    { weight: 10, item: { id: "idle", label: "Sign out when idle", hint: "A forgotten browser does not stay open", done: i.idleSignOut, tab: "security" } },
    { weight: 15, item: { id: "devices", label: "No more than 3 devices signed in", hint: i.devicesSignedIn > 3 ? `${i.devicesSignedIn} devices are signed in: sign out the ones you do not use` : "Few devices, few ways in", done: i.devicesSignedIn <= 3, tab: "security" } },
  ];
  const score = parts.reduce((s, p) => s + (p.item.done ? p.weight : 0), 0);
  const level: SecurityLevel = score >= 90 ? "strong" : score >= 70 ? "good" : score >= 50 ? "fair" : "weak";
  return { score, level, items: parts.map((p) => p.item) };
}

export const LEVEL_LABEL: Record<SecurityLevel, string> = { strong: "Strong", good: "Good", fair: "Fair", weak: "Weak" };

/** Things worth doing, most useful first, drawn from both lists and the alert settings (at most `max`). */
export function nextSteps(i: HealthInput, max = 3): CheckItem[] {
  const steps: CheckItem[] = [
    ...securityScore(i).items.filter((x) => !x.done && x.id === "2fa"),
    ...profileCompleteness(i).items.filter((x) => !x.done),
    ...securityScore(i).items.filter((x) => !x.done && x.id !== "2fa"),
  ];
  if (i.alertsOn === 0 && !i.allMailOff) steps.push({ id: "alerts", label: "Switch on an alert", hint: "Be told when the battery runs low", done: false, tab: "alerts" });
  return steps.slice(0, max);
}
