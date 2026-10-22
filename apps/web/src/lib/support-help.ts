// Answers to the questions customers ask most, shown on the Support page while no ticket is open, so many problems are solved without waiting.
// Plain data: the screen and its test share it. Steps never ask anyone to open equipment or touch wiring.

export interface HelpItem {
  id: string;
  question: string;
  answer: string[];
  /** a page of the dashboard that helps */
  link?: { href: string; label: string };
}

export const HELP_ITEMS: HelpItem[] = [
  {
    id: "offline",
    question: "The dashboard says my inverter is offline",
    answer: [
      "Amber \"Connection lost\" means the monitoring unit is online but cannot read the inverter. Red \"Offline\" means we cannot reach the monitoring unit at all.",
      "Check that the monitoring unit has power and that your Wi-Fi router is on. After a power cut or a router restart it can take a couple of minutes to come back.",
      "If it is still offline after 10 minutes, open a ticket and tell us when it went offline.",
    ],
    link: { href: "/dashboard/maintenance", label: "Open Maintenance" },
  },
  {
    id: "beeping",
    question: "The inverter beeps or shows a fault code",
    answer: ["Note the code on the inverter's screen (for example F58 or W03) and look it up in the guide below: it says what it means and what you can safely try.", "If the code stays or comes back, open a ticket with the code and a photo of the screen."],
    link: { href: "/dashboard/maintenance", label: "Health and faults" },
  },
  {
    id: "no-data",
    question: "The app shows no data, or old data",
    answer: ["Refresh the page. If the device status says Online but the numbers are old, wait a minute: values reach the dashboard about every 30 seconds.", "If the status is Offline, see \"The dashboard says my inverter is offline\"."],
    link: { href: "/dashboard/monitoring", label: "Open Monitoring" },
  },
  {
    id: "battery",
    question: "My battery runs out in the evening",
    answer: ["Check the battery section of your settings: the level the battery keeps in reserve and when it is allowed to charge from the grid both change how long it lasts.", "If the settings look right and it still happens, open a ticket and tell us roughly when it runs out."],
    link: { href: "/dashboard/devices", label: "Device settings" },
  },
  {
    id: "bill",
    question: "My electricity bill looks different from what the app says",
    answer: ["The app prices your energy on your state's tariff, which is shown at the bottom of the Reports page. Bills also include fixed charges and taxes the app does not add.", "If the units differ, open a ticket with the month and the units on your bill."],
    link: { href: "/dashboard/reports", label: "Open Reports" },
  },
  {
    id: "charger",
    question: "My EV charger will not start charging",
    answer: ["Check that the connector is fully seated in the car and that the charger's status in the dashboard is Online and Available. Try unplugging and plugging in again.", "If it stays unavailable, open a ticket with the charger status you see."],
    link: { href: "/dashboard/ev-sessions", label: "Charging sessions" },
  },
  {
    id: "site",
    question: "How do I change my site's address or a device's name?",
    answer: ["Open the Site page, press Edit site, move the pin to your building and check the details, then save."],
    link: { href: "/dashboard/site", label: "Open Site" },
  },
  {
    id: "reports",
    question: "How do I download a report?",
    answer: ["Open Reports, choose the period at the top right, then Generate. You can download a statement, a day or period report, or the readings exactly as your unit took them (the last 4 weeks)."],
    link: { href: "/dashboard/reports", label: "Open Reports" },
  },
  {
    id: "alerts",
    question: "How do I change which e-mails I get?",
    answer: ["Open Application Settings from your account menu. You can switch alert e-mails on or off there."],
    link: { href: "/dashboard/settings", label: "Application Settings" },
  },
  {
    id: "reply",
    question: "How long until someone answers my ticket?",
    answer: ["The team that looks after your site is told the moment you open a ticket, and the first person free takes it. You are e-mailed when someone takes it, and again for every reply, so you do not need to keep the page open."],
  },
];

/** The questions that contain every word typed (nothing typed: all of them). */
export function searchHelp(query: string, items: readonly HelpItem[] = HELP_ITEMS): HelpItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...items];
  return items.filter((i) => {
    const text = `${i.question} ${i.answer.join(" ")}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}
