// A plain check of how good a new password is, shown as the person types: length, a mix of kinds of character, and not one of the passwords
// everybody tries first, nor made of their own e-mail name. It is advice, not the rule (the rule is at least 8 characters).

export interface Strength {
  /** 0 (nothing or very weak) to 4 (strong) */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
  /** what would make it better, most useful first */
  tips: string[];
}

const COMMON = ["password", "passw0rd", "12345678", "123456789", "1234567890", "qwerty123", "qwertyuiop", "iloveyou", "admin123", "welcome1", "welcome123", "letmein1", "abc12345", "waytara", "solar123", "india123", "password1", "password123"];

export function passwordStrength(password: string, email = ""): Strength {
  if (password.length === 0) return { score: 0, label: "Too short", tips: [] };
  const tips: string[] = [];
  const lower = password.toLowerCase();
  // the e-mail name and each piece of it ("manoj.dev" -> "manoj", "dev"), so a password built on any real piece is caught
  const name = email.split("@")[0]?.toLowerCase() ?? "";
  const nameParts = [name, ...name.split(/[._+-]+/)].filter((p) => p.length >= 4);

  if (password.length < 8) return { score: 0, label: "Too short", tips: ["Use at least 8 characters."] };
  if (COMMON.some((c) => lower.includes(c))) return { score: 1, label: "Weak", tips: ["This is one of the first passwords people try: choose something else."] };
  if (nameParts.some((p) => lower.includes(p))) return { score: 1, label: "Weak", tips: ["Do not use your e-mail name in your password."] };

  const kinds = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (password.length >= 16) points += 1;
  if (kinds >= 3) points += 1;
  if (kinds === 4) points += 1;
  if (/^(.)\1+$/.test(password) || /^(?:0123|1234|2345|abcd|qwer)/i.test(password)) points = Math.min(points, 1);

  if (password.length < 12) tips.push("Longer is stronger: 12 or more characters.");
  if (kinds < 3) tips.push("Mix upper and lower case letters, numbers and symbols.");
  const score = (points >= 5 ? 4 : points >= 4 ? 3 : points >= 2 ? 2 : 1) as Strength["score"];
  return { score, label: (["Too short", "Weak", "Fair", "Good", "Strong"] as const)[score], tips };
}
