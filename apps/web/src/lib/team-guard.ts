import "server-only";
import { getTeamAccess } from "@/lib/team-server";

/** For what a super user may also do for the owner (alert rules): the id of the account the work is for. The owner works on their own; a super user on the owner who made them one; an ordinary member is refused. */
export async function requireOwnerOrSuper(ownId: string): Promise<string> {
  const access = await getTeamAccess();
  if (access.kind === "owner") return ownId;
  if (access.superUser && access.ownerIds[0]) return access.ownerIds[0];
  throw new Error("That is part of the account owner's settings.");
}

/** For the settings that belong to the account's owner (notifications, alerts, billing, addresses): a team member is refused, whatever the browser sends. */
export async function requireAccountOwner(): Promise<void> {
  if ((await getTeamAccess()).kind === "member") throw new Error("That is part of the account owner's settings.");
}
