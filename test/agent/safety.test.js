import { describe, expect, it } from 'vitest';

import { isAllowedUrl, requiresConfirmation } from '../../src/agent/safety.js';

describe('isAllowedUrl', () => {
  it('matches a valid URL against an allowlist', () => {
    expect(isAllowedUrl('https://example.test/path', [/^https:\/\/example\.test\//])).toBe(true);
  });

  it('rejects URLs that do not match or cannot be parsed', () => {
    expect(isAllowedUrl('https://blocked.test/path', [/^https:\/\/example\.test\//])).toBe(false);
    expect(isAllowedUrl('not a URL', [/.*/])).toBe(false);
  });
});

describe('requiresConfirmation', () => {
  it('recognizes risky native and ARIA buttons', () => {
    const nativeButton = document.createElement('button');
    Object.defineProperty(nativeButton, 'innerText', { value: 'Delete item' });
    const ariaButton = document.createElement('div');
    ariaButton.setAttribute('role', 'button');
    ariaButton.setAttribute('aria-label', 'Confirm transfer');

    expect(requiresConfirmation(nativeButton)).toBe(true);
    expect(requiresConfirmation(ariaButton)).toBe(true);
  });

  it('does not flag safe buttons or non-button elements', () => {
    const safeButton = document.createElement('button');
    safeButton.textContent = 'Continue';
    const link = document.createElement('a');
    link.textContent = 'Delete item';

    expect(requiresConfirmation(safeButton)).toBe(false);
    expect(requiresConfirmation(link)).toBe(false);
  });
});
