import "server-only";
import { getTeamAccess } from "@/lib/team-server";

/** For the settings that belong to the account's owner (notifications, alerts, billing, addresses): a team member is refused, whatever the browser sends. */
export async function requireAccountOwner(): Promise<void> {
  if ((await getTeamAccess()).kind === "member") throw new Error("That is part of the account owner's settings.");
}
