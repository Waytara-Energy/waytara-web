import { describe, expect, it } from "vitest";
import { accessSentence, buildTeamCodeMail, buildTeamInviteMail, buildTeamSharedMail, buildTeamWelcomeMail } from "./team-mail";

const summary = { role: "operator", deviceCount: 2, operateCount: 1, pageCount: 5, canSchedule: false };
const link = "https://www.example.com/team/join?t=ABCDEF";

describe("what a person can do, in one sentence", () => {
  it("counts devices, the ones they operate, the pages, and the schedule switch", () => {
    expect(accessSentence(summary)).toBe("You can view 2 devices and operate 1 of them, on 5 pages of the dashboard.");
    expect(accessSentence({ ...summary, deviceCount: 1, operateCount: 1, pageCount: 1, canSchedule: true })).toBe("You can view 1 device and operate it, on 1 page of the dashboard, and manage the scheduled reports.");
    expect(accessSentence({ ...summary, deviceCount: 2, operateCount: 2 })).toContain("and operate them");
    expect(accessSentence({ ...summary, operateCount: 0 })).toBe("You can view 2 devices, on 5 pages of the dashboard.");
  });
});

describe("the invitation", () => {
  const mail = buildTeamInviteMail({ memberName: "Asha Rao", ownerName: "Manoj <Loganathan>", summary, link });
  it("says who invited them, their role and access, and carries the link in the text and the button", () => {
    expect(mail.subject).toBe("Manoj <Loganathan> invited you to WayTara");
    expect(mail.text).toContain("Hi Asha,");
    expect(mail.text).toContain("Your role: Operator.");
    expect(mail.text).toContain("You can view 2 devices and operate 1 of them");
    expect(mail.text).toContain(link);
    expect(mail.html).toContain(`href="${link}"`);
  });
  it("explains the code and the 14 days, and tells a stranger to ignore it", () => {
    expect(mail.text).toContain("6-digit code");
    expect(mail.text).toContain("14 days");
    expect(mail.text).toContain("If you do not know this person, ignore this e-mail");
  });
  it("escapes the owner's name in the HTML and never carries a password", () => {
    expect(mail.html).not.toContain("<Loganathan>");
    expect(mail.html).toContain("&lt;Loganathan&gt;");
    expect(mail.text.toLowerCase()).not.toContain("password:");
  });
});

describe("the other three e-mails", () => {
  it("tell someone who already has an account to just sign in", () => {
    const m = buildTeamSharedMail({ memberName: null, ownerName: "Manoj", summary, signInUrl: "https://www.example.com/login" });
    expect(m.text).toContain("Hi there,");
    expect(m.text).toContain("nothing to set up");
    expect(m.text).toContain("https://www.example.com/login");
  });
  it("carry the code and no more", () => {
    const m = buildTeamCodeMail("Asha Rao", "123456");
    expect(m.subject).toBe("123456 is your WayTara code");
    expect(m.text).toContain("123456");
    expect(m.text).toContain("10 minutes");
  });
  it("welcome them with where to sign in, and a way out if it was not them", () => {
    const m = buildTeamWelcomeMail({ memberName: "Asha Rao", ownerName: "Manoj", signInUrl: "https://www.example.com/login" });
    expect(m.text).toContain("https://www.example.com/login");
    expect(m.text).toContain("If you did not create this account");
    expect(m.text.toLowerCase()).not.toMatch(/password: \S/);
  });
});
