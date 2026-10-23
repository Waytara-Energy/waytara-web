// Two-factor sign-in (an authenticator app, TOTP). Supabase says a session is at assurance level aal1 (password) or aal2 (password and code);
// someone with a verified factor must reach aal2 before the dashboard opens.

export interface AssuranceLevels {
  /** "aal1" (password) or "aal2" (password and code), as the auth service words it */
  currentLevel: string | null;
  nextLevel: string | null;
}

/** Has this person signed in with the password but still owes the code? */
export const needsSecondFactor = (aal: AssuranceLevels | null | undefined): boolean => !!aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";

/** A 6-digit code, with spaces and other characters removed. Null when it is not six digits. */
export function cleanTotp(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}
