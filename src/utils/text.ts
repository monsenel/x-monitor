// Collapse runs of blank lines (including lines holding only spaces) into a single newline.
export function collapseNewlines(text: string): string {
  return text.replace(/[ \t]*\n(?:[ \t]*\n)+/g, '\n').trim();
}
