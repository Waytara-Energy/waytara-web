/**
 * Makes a piece of text safe to use as a whole-value case-insensitive match in a Postgres `ilike`.
 *
 * In an `ilike` pattern, `%` matches any run of characters and `_` matches any one character, and `_` is a perfectly normal character in an e-mail address:
 * `john_doe@example.com` as a raw pattern also matches `john.doe@example.com`. Looking an account up that way means the wrong account can be found (and, in
 * a password reset, the code for one account sent to a different address). Escaping the three special characters turns the pattern into plain equality that
 * ignores case, which is what an e-mail lookup needs.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
