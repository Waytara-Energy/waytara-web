/** Reverses the `<ticketId>/<timestamp>-<name>` path this app's and
 *  apps/web's support actions both use for uploads, for display. A tiny
 *  duplicate of apps/web's copy — this repo's rule is apps/admin and
 *  apps/web never import each other's files, only packages/* is shared,
 *  and one function isn't worth a new shared package export. */
export function attachmentFileName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^\d+-/, "");
}
