/** Reverses `actions.ts`'s `attachmentPathFor` for display: strips the
 *  `<ticketId>/<timestamp>-` prefix back off, leaving the original
 *  filename the customer/employee actually uploaded. */
export function attachmentFileName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^\d+-/, "");
}
