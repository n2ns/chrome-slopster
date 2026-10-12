// Replaces global fetch with a queue of canned responses and records every call.
// No test may reach the network.

import { vi } from 'vitest';

export type StubReply = { status?: number; json?: unknown; text?: string } | { reject: unknown };

export interface RecordedCall {
  url: string;
  init: RequestInit;
  headers: Record<string, string>;
  body: unknown;
}

export function stubFetch(...replies: StubReply[]) {
  const calls: RecordedCall[] = [];
  const queue = [...replies];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ url: String(input), init, headers, body });

    const reply = queue.shift();
    if (!reply) throw new Error(`Unexpected fetch: ${String(input)}`);
    if ('reject' in reply) throw reply.reject;
    const text = reply.text ?? JSON.stringify(reply.json ?? null);
    return new Response(text, { status: reply.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
