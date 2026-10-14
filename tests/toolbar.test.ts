import { describe, expect, it } from 'vitest';
import { createToolbar } from '@/src/content-core/toolbar';

describe('toolbar accent color', () => {
  it('styles the translation output from the host accent variable, with the default preset as fallback', () => {
    const unit = document.createElement('p');
    document.body.append(unit);
    const toolbar = createToolbar(unit, 'Translate');
    const css = toolbar.host.shadowRoot!.querySelector('style')!.textContent!;
    expect(css).toContain('border-left-color: var(--slopster-accent, #5b8def)');
    expect(css).toContain('color-mix(in srgb, var(--slopster-accent, #5b8def) 10%, transparent)');
    expect(css).not.toContain('rgba(91, 141, 239');

    toolbar.setAccent('#2e9d5b');
    expect(toolbar.host.style.getPropertyValue('--slopster-accent')).toBe('#2e9d5b');
    document.body.innerHTML = '';
  });
});
