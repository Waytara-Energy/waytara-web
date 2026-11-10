import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { allowed: true };
const sentMail: { to: unknown; mail: { subject: string; text: string; html: string } }[] = [];

vi.mock("./rate-limit", () => ({ allowRequest: async () => state.allowed }));
vi.mock("./send-mail", () => ({
  sendMail: async (to: unknown, mail: { subject: string; text: string; html: string }) => {
    sentMail.push({ to, mail });
    return "sent";
  },
}));

import { acknowledgeLead, buildLeadAckMail } from "./lead-ack";

beforeEach(() => {
  state.allowed = true;
  sentMail.length = 0;
});

describe("the confirmation to someone who sent a form", () => {
  it("says the right thing for each form", () => {
    expect(buildLeadAckMail({ name: "Priya Raman", source: "contact_page" }).subject).toBe("We received your message");
    expect(buildLeadAckMail({ name: "Priya", source: "energy_planner" }).subject).toBe("We received your energy plan request");
    expect(buildLeadAckMail({ name: "Priya", source: "platform_compatibility" }).subject).toBe("We received your equipment details");
    expect(buildLeadAckMail({ name: "Priya", source: "support_request" }).subject).toBe("We received your support request");
  });

  it("falls back to the plain message wording for a source it does not know", () => {
    expect(buildLeadAckMail({ name: "Priya", source: "something_new" }).subject).toBe("We received your message");
  });

  it("greets by first name, offers the phone only for a support request, and tells a stranger to ignore it", () => {
    const support = buildLeadAckMail({ name: "Priya Raman", source: "support_request" });
    expect(support.text).toContain("Hi Priya,");
    expect(support.text).toContain("93848 00141");
    expect(support.text).toContain("you can ignore this e-mail");
    expect(buildLeadAckMail({ name: "Priya", source: "contact_page" }).text).not.toContain("93848 00141");
  });

  it("makes no promise about when, and escapes the name", () => {
    const m = buildLeadAckMail({ name: "<b>Evil</b> Name", source: "contact_page" });
    expect(m.html).not.toContain("<b>Evil</b>");
    expect(m.text).not.toMatch(/within \d|24 hours|same day|guarantee/i);
  });
});

describe("sending it", () => {
  it("sends one to the address that was typed", async () => {
    await acknowledgeLead({ full_name: "Priya", email: "priya@example.com", source: "contact_page" });
    expect(sentMail).toHaveLength(1);
    expect(sentMail[0].to).toBe("priya@example.com");
  });

  it("sends nothing once an address has had its share in the hour", async () => {
    state.allowed = false;
    await acknowledgeLead({ full_name: "Priya", email: "priya@example.com", source: "contact_page" });
    expect(sentMail).toHaveLength(0);
  });
});
