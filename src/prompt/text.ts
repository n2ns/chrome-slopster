// Field normalization and length limits for prompt building.

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()} [truncated; original length ${text.length} chars]`;
}

/** Single-line fields (title, community, URL, author): all whitespace collapses to one space. */
export function limitLine(value: string | undefined, maxLength: number): string {
  return truncate((value ?? '').replace(/\s+/g, ' ').trim(), maxLength);
}

/**
 * Multi-line fields (body, comments, intent, persona text): keeps line breaks and
 * paragraphs, collapses spaces within a line and runs of blank lines.
 */
export function limitMultiline(value: string | undefined, maxLength: number): string {
  const text = (value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return truncate(text, maxLength);
}
