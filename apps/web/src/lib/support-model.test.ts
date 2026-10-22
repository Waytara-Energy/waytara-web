import { describe, expect, it } from "vitest";
import { MAX_FILES, MAX_FILE_BYTES, acceptFiles, attachmentPath, dayStarts, displayName, fileKind, isMine, lastMineId, roleName, safeFileName, seenBy, type MessageView } from "@waytara/ui/support-model";

const msg = (over: Partial<MessageView> & { id: string }): MessageView => ({ ticket_id: "t", sender_id: "x", sender_role: "customer", sender_name: null, body: "hi", internal: false, event: null, attachment_path: null, created_at: "2026-10-23T10:00:00Z", ...over });

describe("whose side a message is on", () => {
  it("is the customer's for the customer, and any team member's for staff", () => {
    expect(isMine(msg({ id: "1", sender_role: "customer" }), "customer")).toBe(true);
    expect(isMine(msg({ id: "1", sender_role: "employee" }), "customer")).toBe(false);
    expect(isMine(msg({ id: "1", sender_role: "site_engineer" }), "staff")).toBe(true);
    expect(isMine(msg({ id: "1", sender_role: "admin" }), "staff")).toBe(true);
    expect(isMine(msg({ id: "1", sender_role: "customer" }), "staff")).toBe(false);
  });
  it("is nobody's for a line the system wrote", () => {
    expect(isMine(msg({ id: "1", sender_role: "system" }), "customer")).toBe(false);
    expect(isMine(msg({ id: "1", sender_role: "system" }), "staff")).toBe(false);
  });
});

describe("seen", () => {
  const ticket = { customer_last_read_at: "2026-10-23T10:05:00Z", staff_last_read_at: "2026-10-23T10:02:00Z", staff_last_read_name: "Ivan" };
  it("is true once the other side opened the ticket after the message was written, and names who", () => {
    expect(seenBy({ created_at: "2026-10-23T10:01:00Z" }, ticket, "customer")).toEqual({ seen: true, by: "Ivan" });
    expect(seenBy({ created_at: "2026-10-23T10:03:00Z" }, ticket, "customer")).toEqual({ seen: false, by: null });
  });
  it("uses the customer's mark for what staff wrote", () => {
    expect(seenBy({ created_at: "2026-10-23T10:04:00Z" }, ticket, "staff").seen).toBe(true);
    expect(seenBy({ created_at: "2026-10-23T10:06:00Z" }, ticket, "staff").seen).toBe(false);
  });
  it("is false while the other side has never opened it", () => {
    expect(seenBy({ created_at: "2026-10-23T10:00:00Z" }, { customer_last_read_at: null, staff_last_read_at: null, staff_last_read_name: null }, "customer").seen).toBe(false);
  });
});

describe("the message that carries the Sent / Seen mark", () => {
  it("is the newest of the viewer's own side, never a note or a system line", () => {
    const list = [msg({ id: "a" }), msg({ id: "b", sender_role: "employee" }), msg({ id: "c" }), msg({ id: "d", sender_role: "system" }), msg({ id: "e", sender_role: "employee", internal: true })];
    expect(lastMineId(list, "customer")).toBe("c");
    expect(lastMineId(list, "staff")).toBe("b");
    expect(lastMineId([], "customer")).toBeNull();
  });
});

describe("day separators", () => {
  it("start at the first message of each day", () => {
    const starts = dayStarts([msg({ id: "1", created_at: "2026-10-22T05:00:00Z" }), msg({ id: "2", created_at: "2026-10-22T09:00:00Z" }), msg({ id: "3", created_at: "2026-10-23T05:00:00Z" })], "UTC");
    expect([...starts]).toEqual(["1", "3"]);
  });
});

describe("files", () => {
  const f = (name: string, size = 1000, type = "") => ({ name, size, type });
  it("takes pictures, PDFs and the like", () => {
    const r = acceptFiles([], [f("a.png", 10, "image/png"), f("b.pdf", 10, "application/pdf"), f("c.xlsx", 10)]);
    expect(r.accepted).toHaveLength(3);
    expect(r.problems).toEqual([]);
  });
  it("refuses a file that is too big, empty or of a kind we do not take, naming it", () => {
    const r = acceptFiles([], [f("big.mp4", MAX_FILE_BYTES + 1, "video/mp4"), f("empty.png", 0, "image/png"), f("run.exe", 10, "application/x-msdownload")]);
    expect(r.accepted).toEqual([]);
    expect(r.problems).toHaveLength(3);
    expect(r.problems[0]).toContain("big.mp4");
    expect(r.problems[2]).toContain("run.exe");
  });
  it("stops at five files in a message, counting those already picked", () => {
    const six = Array.from({ length: 6 }, (_, i) => f(`p${i}.png`, 10, "image/png"));
    const r = acceptFiles([], six);
    expect(r.accepted).toHaveLength(MAX_FILES);
    expect(r.problems).toHaveLength(1);
    expect(acceptFiles(six.slice(0, 4), six.slice(4)).accepted).toHaveLength(1);
  });
  it("tells a picture from a document", () => {
    expect(fileKind("a.JPG")).toBe("image");
    expect(fileKind("a", "image/png")).toBe("image");
    expect(fileKind("a.pdf")).toBe("pdf");
    expect(fileKind("a.mov")).toBe("video");
    expect(fileKind("a.xlsx")).toBe("file");
  });
  it("makes a safe path and shows the name back", () => {
    expect(safeFileName("../../My Photo (1).JPG")).toBe("My_Photo_1_.JPG");
    expect(safeFileName("")).toBe("file");
    const p = attachmentPath("11111111-1111-1111-1111-111111111111", "My Photo.png", false, "22222222-2222-2222-2222-222222222222");
    expect(p).toBe("11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222-My_Photo.png");
    expect(attachmentPath("11111111-1111-1111-1111-111111111111", "n.png", true, "x")).toBe("11111111-1111-1111-1111-111111111111/internal/x-n.png");
    expect(displayName(p)).toBe("My_Photo.png");
    expect(displayName("t/1700000000000-old name.pdf")).toBe("old name.pdf");
  });
});

describe("how the team is described", () => {
  it("says site installer to a customer and site engineer to colleagues", () => {
    expect(roleName("site_engineer", true)).toBe("Site installer");
    expect(roleName("site_engineer", false)).toBe("Site engineer");
    expect(roleName("admin", true)).toBe("WayTara admin");
  });
});
