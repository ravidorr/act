import { afterEach, describe, expect, it, vi } from 'vitest';

import { findTarget } from '../../src/agent/selectors.js';

function setInnerText(element, value) {
  Object.defineProperty(element, 'innerText', { configurable: true, value });
}

function makeVisible(element) {
  Object.defineProperty(element, 'offsetParent', { configurable: true, value: document.body });
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    bottom: 20,
    left: 0,
    right: 100,
    top: 0,
  });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('findTarget', () => {
  it('prefers the element matching all stable anchors', async () => {
    const target = document.createElement('input');
    target.setAttribute('data-testid', 'primary');
    target.setAttribute('role', 'textbox');
    target.setAttribute('aria-label', 'Employee name');
    target.placeholder = 'Enter name';
    target.className = 'candidate';
    setInnerText(target, 'Employee name');
    makeVisible(target);
    document.body.appendChild(target);

    await expect(findTarget({
      testId: 'primary',
      selector: '.candidate',
      role: 'textbox',
      name: 'employee',
      text: 'name',
      placeholder: 'Enter name',
    })).resolves.toBe(target);
  });

  it('finds elements by placeholder, accessible name, and text', async () => {
    const input = document.createElement('input');
    input.placeholder = 'Search';
    const button = document.createElement('button');
    button.title = 'Open settings';
    const text = document.createElement('div');
    setInnerText(text, 'Choose Absence');
    document.body.append(input, button, text);

    await expect(findTarget({ placeholder: 'Search' })).resolves.toBe(input);
    await expect(findTarget({ name: 'settings' })).resolves.toBe(button);
    await expect(findTarget({ text: 'absence' })).resolves.toBe(text);
  });

  it('uses a nested scope and supports selector-only targets', async () => {
    const outer = document.createElement('section');
    outer.id = 'scope';
    const nested = document.createElement('button');
    nested.className = 'save';
    setInnerText(nested, 'Save');
    outer.appendChild(nested);
    document.body.appendChild(outer);

    await expect(findTarget({
      within: { selector: '#scope' },
      selector: '.save',
    })).resolves.toBe(nested);
  });

  it('matches generic ARIA controls and names supplied by labelled-by or text', async () => {
    const labelled = document.createElement('div');
    labelled.setAttribute('role', 'menuitem');
    labelled.setAttribute('aria-labelledby', 'menu-label');
    const byTextName = document.createElement('button');
    setInnerText(byTextName, 'Continue');
    document.body.append(labelled, byTextName);

    await expect(findTarget({ role: 'menuitem' })).resolves.toBe(labelled);
    await expect(findTarget({ name: 'menu-label' })).resolves.toBe(labelled);
    await expect(findTarget({ name: 'continue' })).resolves.toBe(byTextName);
  });

  it('escapes test IDs before querying', async () => {
    const element = document.createElement('button');
    element.setAttribute('data-testid', 'quote"value');
    document.body.appendChild(element);

    await expect(findTarget({ testId: 'quote"value' })).resolves.toBe(element);
  });

  it('reports the last resolver error after retrying', async () => {
    vi.useFakeTimers();
    const result = findTarget({ selector: '[' }, { timeoutMs: 1 });
    const rejection = expect(result).rejects.toThrow('Invalid selector [');

    await vi.advanceTimersByTimeAsync(200);
    await rejection;
  });

  it('reports a missing target when no resolver error occurred', async () => {
    await expect(findTarget({ text: 'missing' }, { timeoutMs: 0 }))
      .rejects.toThrow('Target not found: {"text":"missing"}');
  });

  it('retries unresolved targets before timing out', async () => {
    vi.useFakeTimers();
    const result = findTarget({ text: 'missing' }, { timeoutMs: 1 });
    const rejection = expect(result).rejects.toThrow('Target not found: {"text":"missing"}');

    await vi.advanceTimersByTimeAsync(200);
    await rejection;
  });
});
