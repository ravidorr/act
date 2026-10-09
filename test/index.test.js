import { afterEach, describe, expect, it } from 'vitest';

import { boot, ensureStylesheet, plans, version } from '../src/index.js';

afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
  delete document.currentScript;
});

describe('public entry point', () => {
  it('boots the widget with caller-provided options and injects its stylesheet once', () => {
    const api = boot({
      baseUrl: 'https://assets.example.test/widgets/',
      allowlist: [/^https:\/\/app\.example\.test/],
      plans: { custom: { task: 'Custom', steps: [] } },
    });

    expect(api).toMatchObject({
      open: expect.any(Function),
      close: expect.any(Function),
      toggle: expect.any(Function),
      runTask: expect.any(Function),
      appendLog: expect.any(Function),
    });
    expect(document.querySelector('[data-pact="root"]')).not.toBeNull();
    expect(document.querySelectorAll('link[href="https://assets.example.test/widgets/act-widget.css"]')).toHaveLength(1);

    boot({ baseUrl: 'https://assets.example.test/widgets/' });
    expect(document.querySelectorAll('link[href="https://assets.example.test/widgets/act-widget.css"]')).toHaveLength(2);
  });

  it('does not add a stylesheet when the browser reports an existing one', () => {
    const href = 'https://assets.example.test/widgets/act-widget.css';
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [{ href }],
    });

    boot({ baseUrl: 'https://assets.example.test/widgets/' });

    expect(document.querySelector(`link[href="${href}"]`)).toBeNull();
    delete document.styleSheets;
  });

  it('does not create a stylesheet for an empty URL', () => {
    ensureStylesheet('');

    expect(document.querySelector('link')).toBeNull();
  });

  it('infers the base URL from an Act script when none is supplied', () => {
    const script = document.createElement('script');
    script.src = 'https://cdn.example.test/path/act-widget.js';
    document.head.appendChild(script);

    boot();

    expect(document.querySelector('link[href="https://cdn.example.test/path/act-widget.css"]')).not.toBeNull();
  });

  it('falls back to a relative stylesheet path when the current script URL is invalid', () => {
    Object.defineProperty(document, 'currentScript', {
      configurable: true,
      value: { src: 'not a valid URL' },
    });

    boot();

    expect(document.querySelector('link[href$="act-widget.css"]')).not.toBeNull();
  });

  it('uses a relative stylesheet path when no executing script is available', () => {
    boot();

    expect(document.querySelector('link[href$="act-widget.css"]')).not.toBeNull();
  });

  it('exports the current version and built-in sample plan', () => {
    expect(version).toBe('0.1.0');
    expect(plans.workdayTakeDayOffNextMonday.task).toBe('Take a day off next Monday');
  });
});
