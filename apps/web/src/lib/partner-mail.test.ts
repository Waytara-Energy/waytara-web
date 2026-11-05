import { describe, expect, it } from "vitest";
import { buildPartnerAckMail, buildPartnerAdminMail } from "./partner-mail";

const app = {
  id: "11111111-2222-3333-4444-555555555555",
  company_name: "Sun & Co <Solar>",
  contact_name: "Priya Raman",
  phone: "9876543210",
  email: "priya@example.com",
  website: null,
  states: ["Tamil Nadu", "Kerala"],
  cities: "Chennai, Kochi",
  services: ["solar", "ev_charger"],
  years_in_business: 7,
  installs_completed: "100 to 500",
  team_size: "6 to 20",
  certifications: null,
  message: "We install on <rooftops> & carports.",
};

describe("partner admin mail", () => {
  const mail = buildPartnerAdminMail(app, "https://admin.example.com/");

  it("names the company in the subject and links to the application", () => {
    expect(mail.subject).toBe("New partner application: Sun & Co <Solar>");
    expect(mail.text).toContain("https://admin.example.com/partners/11111111-2222-3333-4444-555555555555");
    expect(mail.html).toContain('href="https://admin.example.com/partners/11111111-2222-3333-4444-555555555555"');
  });

  it("lists what the applicant filled in, with readable service names, and skips what they left out", () => {
    expect(mail.text).toContain("Works in: Tamil Nadu, Kerala");
    expect(mail.text).toContain("Services: Solar installation, EV charger installation");
    expect(mail.text).toContain("Installations so far: 100 to 500");
    expect(mail.text).not.toContain("Website:");
    expect(mail.text).not.toContain("Certifications:");
  });

  it("escapes anything the applicant typed before it goes into the HTML", () => {
    expect(mail.html).toContain("Sun &amp; Co &lt;Solar&gt;");
    expect(mail.html).toContain("We install on &lt;rooftops&gt; &amp; carports.");
    expect(mail.html).not.toContain("<Solar>");
    expect(mail.html).not.toContain("<rooftops>");
  });
});

describe("partner acknowledgement mail", () => {
  const mail = buildPartnerAckMail("Priya Raman", "Sun & Co");

  it("greets by first name and promises nothing about approval", () => {
    expect(mail.text).toContain("Hi Priya,");
    expect(mail.text).toContain("does not guarantee a partnership");
    expect(mail.html).toContain("Sun &amp; Co");
  });
});
