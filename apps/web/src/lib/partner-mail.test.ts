import { describe, expect, it } from "vitest";
import { buildPartnerAckMail, buildPartnerAdminMail } from "./partner-mail";

const app = {
  id: "11111111-2222-3333-4444-555555555555",
  reference: "WTP-2611-K7F3Q",
  partner_type: "contractor",
  company_name: "Sun & Co <Electricals>",
  contact_name: "Priya Raman",
  phone: "9876543210",
  email: "priya@example.com",
  district: "Chennai",
  otherDistricts: ["Vellore", "Salem"],
  answers: [
    { q: "Do you currently hold a TNELB electrical contractor licence?", a: "Yes" },
    { q: "If yes, which grade?", a: "EA" },
    { q: "Your main services", a: "Electrical contracting, Solar EPC" },
  ],
  message: "We work on <rooftops> & carports.",
};

describe("partner admin mail", () => {
  const mail = buildPartnerAdminMail(app, "https://admin.example.com/");

  it("names the reference, the company and the kind of partner in the subject, and links to the application", () => {
    expect(mail.subject).toBe("New partner application WTP-2611-K7F3Q: Sun & Co <Electricals> (Electrical contractor)");
    expect(mail.text).toContain("https://admin.example.com/partners/11111111-2222-3333-4444-555555555555");
    expect(mail.html).toContain('href="https://admin.example.com/partners/11111111-2222-3333-4444-555555555555"');
  });

  it("lists the applicant's districts and every answer, and skips what is empty", () => {
    expect(mail.text).toContain("Reference: WTP-2611-K7F3Q");
    expect(mail.text).toContain("Applying as: Electrical contractor");
    expect(mail.text).toContain("Main district: Chennai");
    expect(mail.text).toContain("Also covers: Vellore, Salem");
    expect(mail.text).toContain("If yes, which grade?: EA");
    expect(mail.text).toContain("Your main services: Electrical contracting, Solar EPC");
    const alone = buildPartnerAdminMail({ ...app, otherDistricts: [] }, "https://admin.example.com");
    expect(alone.text).not.toContain("Also covers");
  });

  it("calls a technician by name, with no separate contact line", () => {
    const tech = buildPartnerAdminMail({ ...app, partner_type: "technician", company_name: "Priya Raman" }, "https://admin.example.com");
    expect(tech.text).toContain("Name: Priya Raman");
    expect(tech.text).not.toContain("Contact:");
    expect(tech.subject).toContain("(Field technician)");
  });

  it("escapes anything the applicant typed before it goes into the HTML", () => {
    expect(mail.html).toContain("Sun &amp; Co &lt;Electricals&gt;");
    expect(mail.html).toContain("We work on &lt;rooftops&gt; &amp; carports.");
    expect(mail.html).not.toContain("<Electricals>");
    expect(mail.html).not.toContain("<rooftops>");
  });
});

describe("partner acknowledgement mail", () => {
  const mail = buildPartnerAckMail("Priya Raman", "WTP-2611-K7F3Q");

  it("greets by first name and gives the reference", () => {
    expect(mail.text).toContain("Hi Priya,");
    expect(mail.text).toContain("WTP-2611-K7F3Q");
    expect(mail.subject).toContain("WTP-2611-K7F3Q");
  });

  it("says what happens next and promises nothing about approval or projects", () => {
    expect(mail.text).toContain("shortlisted");
    expect(mail.text).toContain("not a job application");
    expect(mail.text).toContain("does not guarantee a partnership or any projects");
  });
});
