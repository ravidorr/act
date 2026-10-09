import { afterEach, describe, expect, it, vi } from 'vitest';

import { labelFor, runPlan } from '../../src/agent/core.js';

function setInnerText(element, value) {
  Object.defineProperty(element, 'innerText', { configurable: true, value });
}

function plan(steps) {
  return { task: 'Test plan', steps };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('runPlan', () => {
  it('emits start and success events for a plan with no steps', async () => {
    const events = [];

    await expect(runPlan({ task: 'Empty' }, { onEvent: event => events.push(event) })).resolves.toBeUndefined();

    expect(events).toEqual([
      { type: 'plan:start', task: 'Empty', steps: 0 },
      { type: 'plan:success' },
    ]);
  });

  it('navigates to an allowed relative URL and waits for its path', async () => {
    await expect(runPlan(plan([
      { action: 'navigate', url: '/', timeoutMs: 0 },
    ]), { allowlist: [/^http:\/\/localhost:3000\//] })).resolves.toBeUndefined();
  });

  it('blocks disallowed navigation and reports the failing step', async () => {
    const events = [];

    await expect(runPlan(plan([{ action: 'navigate', url: 'https://blocked.test/path' }]), {
      allowlist: [/^https:\/\/allowed\.test/],
      onEvent: event => events.push(event),
    })).rejects.toThrow('Blocked by allowlist: https://blocked.test/path');

    expect(events.at(-1)).toMatchObject({ type: 'step:fail', i: 0 });
  });

  it('waits for URL, text, and selector conditions', async () => {
    const marker = document.createElement('div');
    marker.id = 'ready';
    setInnerText(document.body, 'Ready');
    document.body.appendChild(marker);

    await expect(runPlan(plan([{
      action: 'waitFor',
      urlIncludes: '/',
      text: 'Ready',
      selector: '#ready',
      timeoutMs: 1,
    }]))).resolves.toBeUndefined();
  });

  it('times out when a wait condition is not met', async () => {
    await expect(runPlan(plan([{ action: 'waitFor', text: 'Missing', timeoutMs: 0 }])))
      .rejects.toThrow('waitFor timeout');
  });

  it('retries waits until a condition is met and respects aborts during retries', async () => {
    vi.useFakeTimers();
    const ready = runPlan(plan([{ action: 'waitFor', text: 'Ready', timeoutMs: 500 }]));
    setInnerText(document.body, 'Ready');
    await vi.advanceTimersByTimeAsync(200);
    await expect(ready).resolves.toBeUndefined();

    const controller = new AbortController();
    Object.defineProperty(document.body, 'innerText', { configurable: true, value: '' });
    const aborted = runPlan(plan([{ action: 'waitFor', text: 'Never', timeoutMs: 500 }]), {
      signal: controller.signal,
    });
    const abortedExpectation = expect(aborted).rejects.toThrow('aborted');
    controller.abort();
    await vi.advanceTimersByTimeAsync(200);
    await abortedExpectation;
  });

  it('clicks normal targets and confirms risky targets', async () => {
    const safe = document.createElement('button');
    safe.id = 'safe';
    const risky = document.createElement('button');
    risky.id = 'risky';
    risky.setAttribute('aria-label', 'Delete record');
    const clicks = [];
    safe.addEventListener('click', () => clicks.push('safe'));
    risky.addEventListener('click', () => clicks.push('risky'));
    document.body.append(safe, risky);
    const confirm = vi.fn().mockResolvedValue(true);

    await runPlan(plan([
      { action: 'click', target: { selector: '#safe' } },
      { action: 'click', target: { selector: '#risky' } },
    ]), { confirm });

    expect(clicks).toEqual(['safe', 'risky']);
    expect(confirm).toHaveBeenCalledWith({ message: 'Confirm clicking: Delete record' });
  });

  it('uses the browser confirmation fallback and stops cancelled risky clicks', async () => {
    const risky = document.createElement('button');
    risky.id = 'risky';
    setInnerText(risky, 'Submit form');
    const click = vi.fn();
    risky.addEventListener('click', click);
    document.body.appendChild(risky);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await expect(runPlan(plan([{ action: 'click', target: { selector: '#risky' } }])))
      .rejects.toThrow('user_cancelled');

    expect(click).not.toHaveBeenCalled();
  });

  it('types into form controls and editable content', async () => {
    const input = document.createElement('input');
    input.id = 'input';
    input.value = 'old';
    const area = document.createElement('textarea');
    area.id = 'area';
    const editable = document.createElement('div');
    editable.id = 'editable';
    editable.contentEditable = 'true';
    Object.defineProperty(editable, 'isContentEditable', { configurable: true, value: true });
    const inputEvents = vi.fn();
    const changeEvents = vi.fn();
    input.addEventListener('input', inputEvents);
    input.addEventListener('change', changeEvents);
    document.body.append(input, area, editable);

    await runPlan(plan([
      { action: 'type', target: { selector: '#input' }, value: 'new' },
      { action: 'type', target: { selector: '#area' }, clear: true },
      { action: 'type', target: { selector: '#editable' }, value: 'editable text' },
      { action: 'type', target: { selector: '#editable' } },
    ]));

    expect(input.value).toBe('new');
    expect(area.value).toBe('');
    expect(editable.textContent).toBe('');
    expect(inputEvents).toHaveBeenCalledOnce();
    expect(changeEvents).toHaveBeenCalledOnce();
  });

  it('rejects type steps for non-editable elements', async () => {
    const target = document.createElement('div');
    target.id = 'target';
    document.body.appendChild(target);

    await expect(runPlan(plan([{ action: 'type', target: { selector: '#target' }, value: 'x' }])))
      .rejects.toThrow('target_not_typable');
  });

  it('selects native controls by value and label', async () => {
    const select = document.createElement('select');
    select.id = 'leave-type';
    select.innerHTML = '<option value="sick">Sick leave</option><option value="vacation">Vacation</option>';
    const events = vi.fn();
    select.addEventListener('change', events);
    document.body.appendChild(select);

    await runPlan(plan([
      { action: 'select', target: { selector: '#leave-type' }, value: 'sick' },
      { action: 'select', target: { selector: '#leave-type' }, label: 'Vacation' },
    ]));

    expect(select.value).toBe('vacation');
    expect(events).toHaveBeenCalledTimes(2);
  });

  it('reports invalid native selections', async () => {
    const select = document.createElement('select');
    select.id = 'leave-type';
    select.innerHTML = '<option value="sick">Sick leave</option>';
    document.body.appendChild(select);

    await expect(runPlan(plan([{ action: 'select', target: { selector: '#leave-type' }, label: 'Vacation' }])))
      .rejects.toThrow('option_not_found');
    await expect(runPlan(plan([{ action: 'select', target: { selector: '#leave-type' } }])))
      .rejects.toThrow('select_requires_value_or_label');
    await expect(runPlan(plan([{ action: 'select', target: { selector: '#leave-type' }, value: null }])))
      .rejects.toThrow('select_requires_value_or_label');
  });

  it('selects an option through a combobox-like control', async () => {
    const trigger = document.createElement('div');
    trigger.id = 'trigger';
    const option = document.createElement('div');
    setInnerText(option, 'Flexible Time Off');
    const triggerClick = vi.fn();
    const optionClick = vi.fn();
    trigger.addEventListener('click', triggerClick);
    option.addEventListener('click', optionClick);
    document.body.append(trigger, option);
    setInnerText(document.body, 'Flexible Time Off');

    await runPlan(plan([{
      action: 'select',
      target: { selector: '#trigger' },
      label: 'Flexible Time Off',
    }]));

    expect(triggerClick).toHaveBeenCalledOnce();
    expect(optionClick).toHaveBeenCalledOnce();
  });

  it('selects combobox options by their value fallback', async () => {
    const trigger = document.createElement('div');
    trigger.id = 'trigger';
    const option = document.createElement('div');
    setInnerText(option, 'Personal leave');
    const optionClick = vi.fn();
    option.addEventListener('click', optionClick);
    document.body.append(trigger, option);
    setInnerText(document.body, 'Personal leave');

    await runPlan(plan([{
      action: 'select',
      target: { selector: '#trigger' },
      value: 'Personal leave',
    }]));

    expect(optionClick).toHaveBeenCalledOnce();
  });

  it('scrolls target elements and the window', async () => {
    const target = document.createElement('div');
    target.id = 'target';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    await runPlan(plan([
      { action: 'scroll', target: { selector: '#target' } },
      { action: 'scroll', y: 200, behavior: 'instant' },
      { action: 'scroll', y: 0 },
      { action: 'scroll' },
    ]));

    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(scrollTo).toHaveBeenCalledWith({ top: 200, behavior: 'instant' });
  });

  it('executes every extract mode', async () => {
    const text = document.createElement('div');
    text.id = 'text';
    setInnerText(text, '  Hello  ');
    const list = document.createElement('ul');
    list.id = 'list';
    list.innerHTML = '<li>One</li><li role="listitem">Two</li>';
    for (const item of list.children) setInnerText(item, item.textContent);
    const table = document.createElement('table');
    table.id = 'table';
    table.innerHTML = '<tr><th>Heading</th><td>Value</td></tr>';
    for (const cell of table.querySelectorAll('th, td')) setInnerText(cell, cell.textContent);
    document.body.append(text, list, table);

    await expect(runPlan(plan([
      { action: 'extract', target: { selector: '#text' }, as: 'text' },
      { action: 'extract', target: { selector: '#list' }, as: 'list' },
      { action: 'extract', target: { selector: '#table' }, as: 'table' },
      { action: 'extract', target: { selector: '#text' } },
    ]))).resolves.toBeUndefined();
  });

  it('reports unknown actions and supports pre-aborted signals', async () => {
    await expect(runPlan(plan([{ action: 'unknown' }]))).rejects.toThrow('Unknown action: unknown');

    const controller = new AbortController();
    controller.abort();
    await expect(runPlan(plan([]), { signal: controller.signal })).rejects.toThrow('aborted');
  });

  it('stops a running plan when its signal aborts', async () => {
    const controller = new AbortController();

    await expect(runPlan(plan([{ action: 'waitFor', text: 'never', timeoutMs: 0 }]), {
      signal: controller.signal,
      onEvent: event => {
        if (event.type === 'plan:start') controller.abort();
      },
    })).rejects.toThrow('aborted');
  });

  it('builds confirmation labels from every available element identifier', () => {
    const named = document.createElement('button');
    named.setAttribute('name', 'named-button');
    const identified = document.createElement('button');
    identified.id = 'identified-button';
    const plain = document.createElement('section');

    expect(labelFor(named)).toBe('named-button');
    expect(labelFor(identified)).toBe('identified-button');
    expect(labelFor(plain)).toBe('SECTION');
  });
});
