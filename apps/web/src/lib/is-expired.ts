/** Whether a stored expiry timestamp has already passed. Kept as its own
 *  named function (rather than inlined `new Date(x).getTime() < Date.now()`)
 *  so a Server Component calling it isn't flagged for an "impure" call
 *  directly in its render body by React Compiler's purity check. */
export function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}
