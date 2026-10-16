/** Removes the given character from the end of a text (a plain loop: no pattern that could backtrack on a long input). */
export function trimEnd(text: string, char: string): string {
  let end = text.length;
  while (end > 0 && text[end - 1] === char) end--;
  return text.slice(0, end);
}

/** Removes the given character from both ends of a text. */
export function trimBoth(text: string, char: string): string {
  let start = 0;
  while (start < text.length && text[start] === char) start++;
  return trimEnd(text.slice(start), char);
}
