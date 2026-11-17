import { describe, expect, it } from "vitest";
import { accessFacts, buildTeamCodeMail, buildTeamInviteMail, buildTeamSharedMail, buildTeamWelcomeMail } from "./team-mail";

const summary = { role: "operator", deviceCount: 2, operateCount: 1, pageCount: 5, canSchedule: false };
const link = "https://www.example.com/team/join?t=ABCDEF";

describe("what a person gets, as a small table", () => {
  it("lists the role, the devices (and how many they operate) and the pages", () => {
    expect(accessFacts(summary)).toEqual([
      ["Role", "Operator"],
      ["Devices", "2 (you can operate 1)"],
      ["Pages", "5"],
    ]);
  });
  it("says view only when they operate none, and all of them when they operate every one", () => {
    expect(accessFacts({ ...summary, operateCount: 0 })[1]).toEqual(["Devices", "2 (view only)"]);
    expect(accessFacts({ ...summary, operateCount: 2 })[1]).toEqual(["Devices", "2 (you can operate them)"]);
    expect(accessFacts({ ...summary, deviceCount: 1, operateCount: 1 })[1]).toEqual(["Devices", "1 (you can operate it)"]);
  });
  it("adds a row for scheduled reports only when allowed", () => {
    expect(accessFacts(summary).map((r) => r[0])).not.toContain("Scheduled reports");
    expect(accessFacts({ ...summary, canSchedule: true }).map((r) => r[0])).toContain("Scheduled reports");
  });
});

describe("the invitation", () => {
  const mail = buildTeamInviteMail({ memberName: "Asha Rao", ownerName: "Manoj <Loganathan>", summary, link });
  it("says who invited them and what they get, and carries the link in the text and the button", () => {
    expect(mail.subject).toBe("Manoj <Loganathan> invited you to WayTara");
    expect(mail.text).toContain("Hi Asha,");
    expect(mail.text).toContain("Role: Operator");
    expect(mail.text).toContain("Devices: 2 (you can operate 1)");
    expect(mail.text).toContain(link);
    expect(mail.html).toContain(`href="${link}"`);
  });
  it("explains the code and the 14 days in one line, and tells a stranger to ignore it", () => {
    expect(mail.text).toContain("6-digit code");
    expect(mail.text).toContain("14 days");
    expect(mail.text).toContain("Not expecting this? Ignore this e-mail.");
  });
  it("is short: no sign-off block, no quick-link grid", () => {
    expect(mail.text).not.toContain("The WayTara Team");
    expect(mail.text).not.toContain("Instagram");
    expect(mail.text.split("\n").length).toBeLessThan(24);
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
  it("carry the code and no more, as one box per digit in the HTML", () => {
    const m = buildTeamCodeMail("Asha Rao", "123456");
    expect(m.subject).toBe("123456 is your WayTara code");
    expect(m.text).toContain("123456");
    expect(m.text).toContain("10 minutes");
    for (const d of ["1", "2", "3", "4", "5", "6"]) expect(m.html).toContain(`>${d}</td>`);
  });
  it("welcome them with where to sign in, and a way out if it was not them", () => {
    const m = buildTeamWelcomeMail({ memberName: "Asha Rao", ownerName: "Manoj", signInUrl: "https://www.example.com/login" });
    expect(m.text).toContain("https://www.example.com/login");
    expect(m.text).toContain("Did not create this account?");
    expect(m.text.toLowerCase()).not.toMatch(/password: \S/);
  });
});
