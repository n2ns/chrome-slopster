import { describe, expect, it } from 'vitest';
import { getDefaultModel, MODEL_ALIASES, MODEL_REGISTRY, resolveModel } from '@/src/models/registry';
import { AI_ENGINES } from '@/src/storage/types';

describe('model registry', () => {
  it.each(AI_ENGINES)('%s offers exactly two options including the default', (engine) => {
    const values = MODEL_REGISTRY[engine].options.map((option) => option.value);
    expect(values).toHaveLength(2);
    expect(values).toContain(getDefaultModel(engine));
  });

  it.each(AI_ENGINES)('%s aliases point at real options and never at themselves', (engine) => {
    const values = MODEL_REGISTRY[engine].options.map((option) => option.value);
    for (const [from, to] of Object.entries(MODEL_ALIASES[engine])) {
      expect(values).toContain(to);
      expect(values).not.toContain(from);
    }
  });

  it('resolves empty and unknown IDs to the default', () => {
    expect(resolveModel('gemini', '')).toBe(getDefaultModel('gemini'));
    expect(resolveModel('gemini', 'no-such-model')).toBe(getDefaultModel('gemini'));
  });

  it('keeps a listed ID', () => {
    const listed = MODEL_REGISTRY.claude.options[0]!.value;
    expect(resolveModel('claude', listed)).toBe(listed);
  });
});
