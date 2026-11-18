import { describe, expect, it } from "vitest";
import { OWNER_ACCESS, loadTeamAccess, parseTeamAccessHeader, teamAccessHeader, type TeamAccess } from "./team-access";

// A small stand-in for the database client: each table answers with the rows it was given.
function fakeDb(tables: { team_members?: { owner_id: string; pages: string[]; can_schedule: boolean; role?: string }[]; customers?: { id: string } | null }) {
  const chain = (rows: unknown, single: unknown) => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = () => q;
    q.maybeSingle = async () => ({ data: single });
    q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows }).then(res);
    return q;
  };
  return { from: (t: string) => (t === "team_members" ? chain(tables.team_members ?? [], null) : chain(null, tables.customers ?? null)) } as never;
}

describe("loadTeamAccess", () => {
  it("treats a person with no active membership as an owner", async () => {
    expect((await loadTeamAccess(fakeDb({ team_members: [] }), "u1", "customer")).kind).toBe("owner");
  });
  it("treats staff and partners as owners (they are never members)", async () => {
    expect((await loadTeamAccess(fakeDb({ team_members: [{ owner_id: "o", pages: ["overview"], can_schedule: false }] }), "u1", "admin")).kind).toBe("owner");
  });
  it("makes an accepted member with no account of their own a member, with the pages they were given in dashboard order", async () => {
    const a = await loadTeamAccess(fakeDb({ team_members: [{ owner_id: "o1", pages: ["reports", "overview"], can_schedule: true }] }), "u1", "customer");
    expect(a).toEqual({ kind: "member", pages: ["overview", "reports"], canSchedule: true, ownerIds: ["o1"], superUser: false });
  });
  it("gives a person on two teams the union of the pages, and the schedule switch if either gave it", async () => {
    const a = await loadTeamAccess(
      fakeDb({
        team_members: [
          { owner_id: "o1", pages: ["overview"], can_schedule: false },
          { owner_id: "o2", pages: ["devices", "overview"], can_schedule: true },
        ],
      }),
      "u1",
      "customer",
    );
    expect(a.pages).toEqual(["overview", "devices"]);
    expect(a.canSchedule).toBe(true);
    expect(a.ownerIds).toEqual(["o1", "o2"]);
  });
  it("keeps the full dashboard for someone who also has a customer account of their own", async () => {
    expect((await loadTeamAccess(fakeDb({ team_members: [{ owner_id: "o1", pages: ["overview"], can_schedule: false }], customers: { id: "u1" } }), "u1", "customer")).kind).toBe("owner");
  });
});

describe("a super user", () => {
  it("has every page and the schedules, whatever pages are stored on the row, and is marked as a super user", async () => {
    const a = await loadTeamAccess(fakeDb({ team_members: [{ owner_id: "o1", pages: ["overview"], can_schedule: false, role: "super" }] }), "u1", "customer");
    expect(a).toMatchObject({ kind: "member", canSchedule: true, ownerIds: ["o1"], superUser: true });
    expect(a.pages).toEqual(["overview", "monitoring", "performance", "reports", "maintenance", "site", "devices"]);
  });
  it("acts first for the account that made them a super user, when they also belong to another team", async () => {
    const a = await loadTeamAccess(
      fakeDb({
        team_members: [
          { owner_id: "plain", pages: ["overview"], can_schedule: false, role: "viewer" },
          { owner_id: "boss", pages: ["overview"], can_schedule: false, role: "super" },
        ],
      }),
      "u1",
      "customer",
    );
    expect(a.ownerIds).toEqual(["boss", "plain"]);
    expect(a.superUser).toBe(true);
  });
  it("survives the header the proxy forwards, and an ordinary member is not one", () => {
    const s: TeamAccess = { kind: "member", pages: ["overview", "devices"], canSchedule: true, ownerIds: ["o1"], superUser: true };
    expect(parseTeamAccessHeader(teamAccessHeader(s))?.superUser).toBe(true);
    expect(parseTeamAccessHeader('{"p":["overview"],"s":false,"o":[]}')?.superUser).toBe(false);
  });
});

describe("the header the proxy forwards", () => {
  it("round-trips an owner and a member", () => {
    expect(parseTeamAccessHeader(teamAccessHeader(OWNER_ACCESS))).toEqual(OWNER_ACCESS);
    const m: TeamAccess = { kind: "member", pages: ["overview", "site"], canSchedule: false, ownerIds: ["o1"], superUser: false };
    expect(parseTeamAccessHeader(teamAccessHeader(m))).toEqual(m);
  });
  it("is ASCII, as a header must be", () => {
    const m: TeamAccess = { kind: "member", pages: ["overview"], canSchedule: true, ownerIds: ["0a1b2c3d-0000-0000-0000-000000000000"], superUser: true };
    expect(/^[\x20-\x7e]*$/.test(teamAccessHeader(m))).toBe(true);
  });
  it("reads anything else as missing, so the database is asked instead", () => {
    expect(parseTeamAccessHeader(null)).toBeNull();
    expect(parseTeamAccessHeader("")).toBeNull();
    expect(parseTeamAccessHeader("{not json")).toBeNull();
    expect(parseTeamAccessHeader('{"p":"overview"}')).toBeNull();
  });
  it("drops page names it does not know", () => {
    expect(parseTeamAccessHeader('{"p":["overview","billing"],"s":false,"o":[]}')?.pages).toEqual(["overview"]);
  });
  it("only treats a strict true as the schedule switch", () => {
    expect(parseTeamAccessHeader('{"p":["overview"],"s":"yes","o":[]}')?.canSchedule).toBe(false);
  });
});
