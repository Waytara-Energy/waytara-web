import { describe, expect, it } from "vitest";
import { buildSupportEmail, roleLabel, ticketUrl, type SupportKind, type SupportMailInput } from "./support-mail";
import { planSupportBatch, retryDelayMs, type QueueRow, type RecipientFacts, type TicketFacts } from "./support-plan";

const base: SupportMailInput = { kind: "taken", recipientName: "Chitra Customer", ticketNo: 1042, subject: "Inverter beeps", siteName: "Villa", payload: {}, attachments: 0, url: "https://app.example/dashboard/support/abc" };
const mail = (over: Partial<SupportMailInput>) => buildSupportEmail({ ...base, ...over });

describe("the support e-mails", () => {
  it("name the person and the role when someone takes a ticket", () => {
    const m = mail({ kind: "taken", payload: { assignee_name: "Ivan Installer", assignee_role: "site_engineer" } });
    expect(m.subject).toBe("Ivan Installer is now handling your ticket #1042");
    expect(m.text).toContain("Ivan Installer (site installer) has taken your ticket");
    expect(m.text).toContain("Hi Chitra,");
  });

  it("say who took over from whom when a ticket is reassigned", () => {
    const m = mail({ kind: "reassigned", payload: { assignee_name: "Emil Employee", assignee_role: "employee", previous_name: "Ivan Installer" } });
    expect(m.subject).toBe("Your ticket #1042 is now with Emil Employee");
    expect(m.text).toContain("who took over from Ivan Installer");
    expect(m.text).toContain("do not need to do anything");
  });

  it("quote the reply and count the files", () => {
    const m = mail({ kind: "staff_reply", payload: { actor_name: "Asha Admin", preview: "We will visit tomorrow." }, attachments: 2 });
    expect(m.subject).toBe("Asha Admin replied to your ticket #1042");
    expect(m.text).toContain('"We will visit tomorrow."');
    expect(m.text).toContain("2 files attached");
    expect(mail({ kind: "staff_reply", payload: { actor_name: "A" }, attachments: 1 }).text).toContain("1 file attached");
  });

  it("ask the customer to rate when a ticket is closed, and to confirm when it is resolved", () => {
    expect(mail({ kind: "closed", payload: { actor_name: "Asha" } }).html).toContain("Rate your experience");
    expect(mail({ kind: "resolved", payload: { actor_name: "Asha" } }).text).toContain("reopen it");
  });

  it("tell staff how a customer rated, with their comment", () => {
    const m = mail({ kind: "closed_by_customer", payload: { actor_name: "Chitra", rating: 4, comment: "Quick and kind" } });
    expect(m.subject).toBe("Ticket #1042 was closed by the customer: 4 out of 5");
    expect(m.text).toContain("★★★★☆");
    expect(m.text).toContain("Quick and kind");
  });

  it("tell the team a new ticket is waiting and that anyone can take it", () => {
    const m = mail({ kind: "new_ticket", payload: { customer_name: "Chitra Customer", category: "device", preview: "It beeps." } });
    expect(m.subject).toBe("New support ticket #1042: Inverter beeps (Villa)");
    expect(m.text).toContain("Device or inverter");
    expect(m.text).toContain("anyone on the team can");
  });

  it("put the link on the button, in the text and in the HTML", () => {
    const m = mail({ kind: "taken", payload: { assignee_name: "A" } });
    expect(m.text).toContain("https://app.example/dashboard/support/abc");
    expect(m.html).toContain('href="https://app.example/dashboard/support/abc"');
  });

  it("never lets a customer's words break the HTML", () => {
    const m = mail({ kind: "customer_reply", payload: { actor_name: "<b>x</b>", preview: '<script>alert("hi")</script>' } });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });

  it("have a subject and a link for every kind", () => {
    const kinds: SupportKind[] = ["ticket_received", "new_ticket", "staff_reply", "customer_reply", "taken", "reassigned", "assigned_to_you", "unassigned_from_you", "resolved", "closed", "reopened", "reopened_by_customer", "closed_by_customer", "rated"];
    for (const kind of kinds) {
      const m = mail({ kind, payload: { actor_name: "Asha", assignee_name: "Ivan", rating: 5 } });
      expect(m.subject.length, kind).toBeGreaterThan(10);
      expect(m.text, kind).toContain(base.url);
    }
  });

  it("describe the team the way a customer would", () => {
    expect(roleLabel("site_engineer")).toBe("site installer");
    expect(roleLabel("employee")).toBe("site employee");
    expect(roleLabel("admin")).toBe("WayTara admin");
  });

  it("send the customer to the dashboard and staff to the admin app", () => {
    const urls = { customerApp: "https://www.example.com/", adminApp: "https://admin.example.com" };
    expect(ticketUrl("customer", "t1", urls)).toBe("https://www.example.com/dashboard/support/t1");
    expect(ticketUrl("staff", "t1", urls)).toBe("https://admin.example.com/support/t1");
  });
});

describe("which queued e-mails go out", () => {
  const T0 = Date.parse("2026-10-23T10:00:00Z");
  const at = (s: number) => new Date(T0 + s * 1000).toISOString();
  const row = (over: Partial<QueueRow> & { id: number }): QueueRow => ({ ticket_id: "t1", recipient_id: "cust", audience: "customer", kind: "staff_reply", payload: {}, created_at: at(0), attempts: 0, ...over });
  const person = (over: Partial<RecipientFacts> = {}): RecipientFacts => ({ id: "cust", email: "c@example.com", deactivated_at: null, deleted_at: null, ...over });
  const ticket = (over: Partial<TicketFacts> = {}): TicketFacts => ({ id: "t1", customer_last_read_at: null, staff_last_read_at: null, ...over });
  const run = (rows: QueueRow[], t = ticket(), p = person()) => planSupportBatch(rows, new Map([["t1", t]]), new Map([[p.id, p]]));

  it("sends an event as it is", () => {
    const plan = run([row({ id: 1, kind: "taken" })]);
    expect(plan.send.map((s) => s.row.id)).toEqual([1]);
    expect(plan.close).toEqual([]);
  });

  it("does not e-mail a reply the person already read in the app", () => {
    const plan = run([row({ id: 1, created_at: at(0) })], ticket({ customer_last_read_at: at(20) }));
    expect(plan.send).toEqual([]);
    expect(plan.close[0]!.note).toContain("read in the app");
  });

  it("does e-mail a reply that arrived after the last time it was read", () => {
    expect(run([row({ id: 1, created_at: at(30) })], ticket({ customer_last_read_at: at(20) })).send).toHaveLength(1);
  });

  it("checks the staff side for a customer's reply", () => {
    const rows = [row({ id: 1, kind: "customer_reply", audience: "staff", recipient_id: "emp" })];
    const staff = person({ id: "emp" });
    expect(run(rows, ticket({ staff_last_read_at: at(10) }), staff).send).toHaveLength(0);
    expect(run(rows, ticket({ customer_last_read_at: at(10) }), staff).send).toHaveLength(1);
  });

  it("merges several replies for one person into one e-mail about the newest", () => {
    const plan = run([row({ id: 1, payload: { preview: "first" } }), row({ id: 2, payload: { preview: "second" } }), row({ id: 3, payload: { preview: "third" } })]);
    expect(plan.send).toHaveLength(1);
    expect(plan.send[0]!.row.payload.preview).toBe("third");
    expect(plan.send[0]!.covers.map((c) => c.id)).toEqual([3, 2, 1]);
  });

  it("keeps an event and a reply apart", () => {
    expect(run([row({ id: 1, kind: "taken" }), row({ id: 2 })]).send).toHaveLength(2);
  });

  it("closes what has nobody to go to, without sending", () => {
    for (const p of [person({ email: null }), person({ deactivated_at: "2026-01-01" }), person({ deleted_at: "2026-01-01" })]) {
      const plan = run([row({ id: 1, kind: "taken" })], ticket(), p);
      expect(plan.send).toEqual([]);
      expect(plan.close[0]!.ids).toEqual([1]);
    }
    expect(planSupportBatch([row({ id: 1 })], new Map(), new Map()).close[0]!.ids).toEqual([1]);
  });

  it("respects a customer who switched support e-mails off, but never a staff member's setting", () => {
    expect(run([row({ id: 1, kind: "taken" })], ticket(), person({ support_emails: false })).send).toEqual([]);
    const staff = row({ id: 2, kind: "new_ticket", audience: "staff", recipient_id: "emp" });
    expect(run([staff], ticket(), person({ id: "emp", support_emails: false })).send).toHaveLength(1);
  });

  it("waits longer after each failure", () => {
    expect(retryDelayMs(1)).toBe(2 * 60_000);
    expect(retryDelayMs(3)).toBe(6 * 60_000);
    expect(retryDelayMs(5)).toBe(6 * 3_600_000);
  });
});
