import { describe, expect, it } from "vitest";
import { OWNER_ACCESS, loadTeamAccess, parseTeamAccessHeader, teamAccessHeader, type TeamAccess } from "./team-access";

// A small stand-in for the database client: each table answers with the rows it was given.
function fakeDb(tables: { team_members?: { owner_id: string; pages: string[]; can_schedule: boolean }[]; customers?: { id: string } | null }) {
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
    expect(a).toEqual({ kind: "member", pages: ["overview", "reports"], canSchedule: true, ownerIds: ["o1"] });
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

describe("the header the proxy forwards", () => {
  it("round-trips an owner and a member", () => {
    expect(parseTeamAccessHeader(teamAccessHeader(OWNER_ACCESS))).toEqual(OWNER_ACCESS);
    const m: TeamAccess = { kind: "member", pages: ["overview", "site"], canSchedule: false, ownerIds: ["o1"] };
    expect(parseTeamAccessHeader(teamAccessHeader(m))).toEqual(m);
  });
  it("is ASCII, as a header must be", () => {
    const m: TeamAccess = { kind: "member", pages: ["overview"], canSchedule: true, ownerIds: ["0a1b2c3d-0000-0000-0000-000000000000"] };
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
