// JSON Schema of the generation output, for providers that can enforce one
// (Claude structured outputs). Field names must match what the prompt asks for
// and what parseGenerationOutput() reads.

export const GENERATION_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    should_reply: { type: 'boolean' },
    reason: { type: 'string' },
    reply: { type: 'string' },
    title: { type: 'string' },
    reply_native: { type: 'string' },
    review_notes: { type: 'string' },
  },
  required: ['should_reply', 'reason', 'reply', 'reply_native', 'review_notes'],
  additionalProperties: false,
} as const;
