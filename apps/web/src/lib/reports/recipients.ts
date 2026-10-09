// The e-mail addresses a report goes to: the customer's own (unless turned off) and any others they add, at most MAX_RECIPIENTS.

export const MAX_RECIPIENTS = 10;
const EMAIL = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}$/;

export const isEmail = (s: string) => s.length <= 254 && EMAIL.test(s);

/** Splits what was typed or pasted (commas, semicolons, spaces, new lines) into addresses; the same address once, lower case. */
export function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const e = raw.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    (isEmail(e) ? valid : invalid).push(e);
  }
  return { valid, invalid };
}

/** Everyone the report is sent to: the customer's own address (when `sendToMe`) followed by the extras, without repeats. */
export function allRecipients(own: string | null, sendToMe: boolean, extra: string[]): string[] {
  const out: string[] = [];
  for (const e of [...(sendToMe && own ? [own] : []), ...extra]) {
    const x = e.trim().toLowerCase();
    if (x && !out.includes(x)) out.push(x);
  }
  return out;
}
