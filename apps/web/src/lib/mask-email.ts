/** "m***@gmail.com": enough to recognise an address without printing it in full. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 1)}***@${domain}`;
}
