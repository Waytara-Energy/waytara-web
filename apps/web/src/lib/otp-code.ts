/**
 * The 6 digits in whatever was pasted. A pasted e-mail line such as "Your code is 675606" or "675 606" works; if the text holds a run of exactly six digits that wins
 * (so a year or a phone number next to it cannot spoil it), otherwise every digit is taken, up to six.
 */
export function extractCode(text: string): string {
  const run = text.match(/(?<!\d)\d{6}(?!\d)/);
  if (run) return run[0];
  return text.replace(/\D/g, "").slice(0, 6);
}
