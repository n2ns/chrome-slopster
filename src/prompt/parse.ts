// Lenient parsing of the model's JSON output. Even in JSON mode, models wrap the
// object in Markdown fences, add a sentence around it, leave trailing commas,
// or emit "false" as a string, so each step falls back gracefully.

import type { ParsedGeneration } from './types';

/** First complete, brace-balanced JSON object in `text`, ignoring braces inside strings. */
function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start < 0) return '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = inString;
    } else if (char === '"') {
      inString = !inString;
    } else if (!inString && char === '{') {
      depth += 1;
    } else if (!inString && char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return '';
}

/** Remove trailing structural commas without changing quoted JSON values. */
function removeTrailingCommas(text: string): string {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (escaped) {
      escaped = false;
    } else if (char === '\\' && inString) {
      escaped = true;
    } else if (char === '"') {
      inString = !inString;
    } else if (char === ',' && !inString) {
      let next = index + 1;
      while (next < text.length && /\s/.test(text[next]!)) next += 1;
      if (text[next] === '}' || text[next] === ']') continue;
    }
    result += char;
  }
  return result;
}

function tryParseObject(candidate: string): Record<string, unknown> | null {
  const text = candidate.trim();
  if (!text) return null;
  // Models occasionally leave trailing commas, which JSON.parse rejects.
  for (const attempt of [text, removeTrailingCommas(text)]) {
    try {
      const parsed: unknown = JSON.parse(attempt);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      // Try the next variant.
    }
  }
  return null;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const candidates = [raw];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fenced?.[1]) candidates.push(fenced[1], extractJsonObject(fenced[1]));
  // Brace matching over the whole text also survives code fences inside the reply.
  candidates.push(extractJsonObject(raw));
  for (const candidate of candidates) {
    const parsed = tryParseObject(candidate);
    if (parsed) return parsed;
  }
  return null;
}

/** "Boolean" fields may arrive as strings or numbers. Anything not clearly negative counts as true. */
export function isNegativeFlag(value: unknown): boolean {
  if (value === false || value === 0) return true;
  if (typeof value !== 'string') return false;
  return ['false', 'no', '0', '否'].includes(value.trim().toLowerCase());
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseGenerationOutput(raw: string): ParsedGeneration | null {
  const source = parseJsonObject(raw.trim());
  if (!source) return null;
  const reply = asText(source.reply);
  if (!reply) return null;

  const result: ParsedGeneration = {
    shouldReply: !isNegativeFlag(source.should_reply),
    reason: asText(source.reason),
    reply,
    replyNative: asText(source.reply_native),
    reviewNotes: asText(source.review_notes),
  };
  const title = asText(source.title);
  if (title) result.title = title;
  return result;
}
