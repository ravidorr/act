import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWidget, cssPath } from '../../src/ui/widget.js';

function submit(form) {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('createWidget', () => {
  it('opens, closes, and runs quick actions and matching chat plans', async () => {
    const runPlan = vi.fn().mockResolvedValue(undefined);
    createWidget({ runPlan });
    const root = document.querySelector('[data-pact="root"]');
    const launcher = root.querySelector('.pact-launcher');
    const panel = root.querySelector('.pact-panel');
    const form = root.querySelector('.pact-form');
    const input = root.querySelector('.pact-input');

    expect(input.getAttribute('aria-label')).toBe('Automation request');
    launcher.click();
    expect(panel.classList.contains('pact-hidden')).toBe(false);
    launcher.click();
    expect(panel.classList.contains('pact-hidden')).toBe(true);
    root.querySelector('.pact-close').click();
    expect(panel.classList.contains('pact-hidden')).toBe(true);

    root.querySelector('.pact-quick-btn').click();
    await vi.waitFor(() => expect(runPlan).toHaveBeenCalledTimes(1));
    expect(runPlan.mock.calls[0][0].task).toBe('Take a day off next Monday');

    submit(form);
    expect(runPlan).toHaveBeenCalledTimes(1);

    input.value = 'Take a vacation next Monday';
    submit(form);
    await vi.waitFor(() => expect(runPlan).toHaveBeenCalledTimes(2));

    input.value = 'Open an unsupported screen';
    submit(form);
    await vi.waitFor(() => {
      expect(root.querySelector('.pact-log').textContent).toContain('No matching plan');
    });
  });

  it('records DOM interactions, saves them, runs them, and clears the recording', async () => {
    vi.useFakeTimers();
    const runPlan = vi.fn().mockResolvedValue(undefined);
    createWidget({ runPlan });
    const root = document.querySelector('[data-pact="root"]');
    const record = root.querySelector('.pact-record');

    root.querySelector('.pact-run-recording').click();
    expect(root.querySelector('.pact-log').textContent).toContain('No recording found');

    const named = document.createElement('button');
    named.id = 'external-button';
    named.setAttribute('role', 'button');
    named.setAttribute('aria-label', 'External action');
    Object.defineProperty(named, 'innerText', { value: 'External action' });
    const tested = document.createElement('button');
    tested.setAttribute('data-testid', 'external-test');
    const plain = document.createElement('span');
    plain.className = 'first second third';
    const sibling = document.createElement('span');
    const field = document.createElement('input');
    field.placeholder = 'External value';
    field.value = 'new value';
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    editable.textContent = 'editable value';
    const nonEditable = document.createElement('div');
    document.body.append(named, tested, plain, sibling, field, editable, nonEditable);

    record.click();
    expect(record.getAttribute('aria-pressed')).toBe('true');
    named.click();
    tested.click();
    plain.click();
    field.dispatchEvent(new Event('change', { bubbles: true }));
    editable.dispatchEvent(new Event('change', { bubbles: true }));
    nonEditable.dispatchEvent(new Event('change', { bubbles: true }));
    root.querySelector('.pact-launcher').click();
    root.querySelector('.pact-input').dispatchEvent(new Event('change', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);

    record.click();
    expect(record.getAttribute('aria-pressed')).toBe('false');
    root.querySelector('.pact-save').click();

    const saved = JSON.parse(localStorage.getItem('pact.recorder.plan'));
    expect(saved.task).toBe('Recorded Task');
    expect(saved.steps).toHaveLength(5);
    expect(saved.steps[0].target).toMatchObject({
      selector: '#external-button',
      role: 'button',
      name: 'External action',
      text: 'External action',
    });
    expect(saved.steps[1].target.selector).toBe('[data-testid="external-test"]');
    expect(saved.steps[2].target.selector).toContain('span.first.second');
    expect(saved.steps[3]).toMatchObject({ action: 'type', value: 'new value' });
    expect(saved.steps[4]).toMatchObject({ action: 'type', value: 'editable value' });

    root.querySelector('.pact-run-recording').click();
    await vi.waitFor(() => expect(runPlan).toHaveBeenCalledOnce());
    root.querySelector('.pact-clear-recording').click();
    expect(localStorage.getItem('pact.recorder.plan')).toBeNull();
    expect(root.querySelector('.pact-log').textContent).toContain('Cleared saved recording');
  });

  it('passes agent events through to the log and restores controls after errors', async () => {
    const runPlan = vi.fn(async (_plan, options) => {
      options.onEvent({ type: 'step:start', i: 0, step: { action: 'click' } });
      options.onEvent({ type: 'step:success', i: 0 });
      options.onEvent({ type: 'step:fail', i: 1, error: 'failed step' });
      options.onEvent({ type: 'plan:success' });
    });
    const widget = createWidget({ runPlan });
    const root = document.querySelector('[data-pact="root"]');

    await widget.runTask({ task: 'Happy path', steps: [] });

    expect(root.querySelector('.pact-log').textContent).toContain('#1 click');
    expect(root.querySelector('.pact-log').textContent).toContain('#1 ✓');
    expect(root.querySelector('.pact-log').textContent).toContain('#2 failed step');
    expect(root.querySelector('.pact-log').textContent).toContain('Done in');
    expect(root.querySelector('.pact-run').disabled).toBe(false);
    expect(root.querySelector('.pact-stop').disabled).toBe(true);

    runPlan.mockRejectedValueOnce(new Error('network failed'));
    await widget.runTask({ task: 'Failure', steps: [] });
    expect(root.querySelector('.pact-log').textContent).toContain('Failed: Error: network failed');
  });

  it('shows confirmation dialogs and reports cancelled task execution', async () => {
    const runPlan = vi.fn(async (_plan, options) => {
      const confirmation = options.confirm({ message: 'Proceed?' });
      expect(document.querySelector('.pact-confirm').parentElement).toBe(root);
      document.querySelector('.pact-btn-yes').click();
      await expect(confirmation).resolves.toBe(true);

      const cancellation = options.confirm({ message: 'Cancel?' });
      document.querySelector('.pact-btn-no').click();
      await expect(cancellation).resolves.toBe(false);
      throw new Error('aborted');
    });
    const widget = createWidget({ runPlan });
    const root = document.querySelector('[data-pact="root"]');

    await widget.runTask({ task: 'Risky task', steps: [] });

    expect(root.querySelector('.pact-confirm')).toBeNull();
    expect(document.querySelector('.pact-confirm')).toBeNull();
    expect(root.querySelector('.pact-log').textContent).toContain('Stopped by user');
  });

  it('aborts an active task and ignores duplicate run requests', async () => {
    let resolveRun;
    const runPlan = vi.fn((_plan, options) => new Promise((resolve, reject) => {
      resolveRun = resolve;
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const widget = createWidget({ runPlan });
    const root = document.querySelector('[data-pact="root"]');
    const pending = widget.runTask({ task: 'Long task', steps: [] });

    await vi.waitFor(() => expect(runPlan).toHaveBeenCalledOnce());
    await widget.runTask({ task: 'Ignored duplicate', steps: [] });
    expect(runPlan).toHaveBeenCalledOnce();
    root.querySelector('.pact-stop').click();
    await pending;
    resolveRun?.();

    expect(root.querySelector('.pact-log').textContent).toContain('Stopped by user');
  });

  it('handles idle stop clicks and the recorder callbacks after recording stops', () => {
    const callbacks = {};
    const addEventListener = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((type, callback, options) => {
      if (options === true && (type === 'click' || type === 'change')) {
        callbacks[type] = callback;
        return;
      }
      addEventListener(type, callback, options);
    });
    createWidget();
    const root = document.querySelector('[data-pact="root"]');
    const external = document.createElement('div');
    document.body.appendChild(external);

    root.querySelector('.pact-stop').click();
    root.querySelector('.pact-record').click();
    callbacks.change({
      target: { closest: () => false, isContentEditable: false },
    });
    root.querySelector('.pact-record').click();
    callbacks.click({ target: external });
    callbacks.change({ target: external });

    expect(root.querySelector('.pact-log').textContent).toContain('Recording stopped. Steps: 0.');
  });

  it('records empty editable and form values but skips non-editable changes', () => {
    createWidget();
    const root = document.querySelector('[data-pact="root"]');
    const field = document.createElement('input');
    const area = document.createElement('textarea');
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    const nonEditable = document.createElement('div');
    document.body.append(field, area, editable, nonEditable);

    root.querySelector('.pact-record').click();
    field.dispatchEvent(new Event('change', { bubbles: true }));
    area.dispatchEvent(new Event('change', { bubbles: true }));
    editable.dispatchEvent(new Event('change', { bubbles: true }));
    nonEditable.dispatchEvent(new Event('change', { bubbles: true }));
    root.querySelector('.pact-record').click();
    root.querySelector('.pact-save').click();

    expect(JSON.parse(localStorage.getItem('pact.recorder.plan')).steps).toEqual([
      expect.objectContaining({ action: 'type', value: '' }),
      expect.objectContaining({ action: 'type', value: '' }),
      expect.objectContaining({ action: 'type', value: '' }),
    ]);
  });

  it('recognizes textarea changes as recordable form controls', () => {
    createWidget();
    const root = document.querySelector('[data-pact="root"]');
    const area = document.createElement('textarea');
    area.value = 'Notes';
    document.body.appendChild(area);

    expect(area instanceof HTMLInputElement).toBe(false);
    expect(area instanceof HTMLTextAreaElement).toBe(true);
    root.querySelector('.pact-record').click();
    area.dispatchEvent(new Event('change', { bubbles: true }));
    root.querySelector('.pact-record').click();
    root.querySelector('.pact-save').click();

    expect(JSON.parse(localStorage.getItem('pact.recorder.plan')).steps).toEqual([
      expect.objectContaining({ action: 'type', value: 'Notes' }),
    ]);
  });

  it('builds stable selectors for detached and nested elements', () => {
    const detached = document.createElement('div');
    detached.className = ' ';
    const container = document.createElement('div');
    container.id = 'container';
    const child = document.createElement('span');
    container.appendChild(child);
    document.body.appendChild(container);

    expect(cssPath(null)).toBeNull();
    expect(cssPath(document.createTextNode('text'))).toBeNull();
    expect(cssPath(detached)).toBe('');
    expect(cssPath(child)).toBe('#container > span');
  });

  it('uses default options and runs the deferred demo callback', async () => {
    vi.useFakeTimers();
    const widget = createWidget();

    widget.appendLog('Test', 'Message');
    expect(document.querySelector('.pact-log').textContent).toContain('[Test] Message');
    await vi.advanceTimersByTimeAsync(0);
  });
});
