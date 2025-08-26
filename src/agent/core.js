// Core agent: executes a JSON plan using DOM-based primitives.
// Keeps everything client-side. No inline CSS used anywhere.

import { findTarget } from './selectors.js';
import { isAllowedUrl, requiresConfirmation } from './safety.js';

export async function runPlan(plan, opts) {
  const { allowlist = [/.*/], onEvent = () => {}, confirm = defaultConfirm, signal } = opts || {};
  const ctx = { allowlist, onEvent, confirm, aborted: false };

  const abortHandler = () => { ctx.aborted = true; };
  if (signal) {
    if (signal.aborted) throw new Error('aborted');
    signal.addEventListener('abort', abortHandler, { once: true });
  }

  onEvent({ type: 'plan:start', task: plan.task, steps: plan.steps?.length || 0 });
  try {
    for (let i = 0; i < (plan.steps?.length || 0); i++) {
      if (ctx.aborted) throw new Error('aborted');
      const step = plan.steps[i];
      onEvent({ type: 'step:start', i, step });
      try {
        await execStep(step, ctx);
        onEvent({ type: 'step:success', i });
      } catch (err) {
        onEvent({ type: 'step:fail', i, error: String(err) });
        throw err;
      }
    }
    onEvent({ type: 'plan:success' });
  } finally {
    if (signal) signal.removeEventListener('abort', abortHandler);
  }
}

async function execStep(step, ctx) {
  switch (step.action) {
    case 'navigate':
      return navigate(step.url, ctx);
    case 'waitFor':
      return waitFor(step, ctx);
    case 'click':
      return click(step, ctx);
    case 'type':
      return type(step, ctx);
    case 'select':
      return select(step, ctx);
    case 'scroll':
      return scroll(step, ctx);
    case 'extract':
      return extract(step, ctx);
    default:
      throw new Error(`Unknown action: ${step.action}`);
  }
}

async function navigate(url, ctx) {
  const full = new URL(url, location.href).toString();
  if (!isAllowedUrl(full, ctx.allowlist)) throw new Error(`Blocked by allowlist: ${full}`);
  location.assign(full);
  await waitFor({ action: 'waitFor', urlIncludes: new URL(full).pathname }, ctx);
}

async function waitFor(step, ctx) {
  const timeout = step.timeoutMs ?? 15000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (ctx.aborted) throw new Error('aborted');
    const byUrl = step.urlIncludes ? location.href.includes(step.urlIncludes) : true;
    const byText = step.text ? document.body.innerText.includes(step.text) : true;
    const bySel = step.selector ? document.querySelector(step.selector) : true;
    if (byUrl && byText && bySel) return;
    await sleep(200);
  }
  throw new Error('waitFor timeout');
}

async function click(step, ctx) {
  const el = await findTarget(step.target, { timeoutMs: step.timeoutMs ?? 10000 });
  if (requiresConfirmation(el)) {
    const ok = await ctx.confirm({ message: `Confirm clicking: ${labelFor(el)}` });
    if (!ok) throw new Error('user_cancelled');
  }
  el.click();
}

async function type(step, ctx) {
  const el = await findTarget(step.target, { timeoutMs: step.timeoutMs ?? 10000 });
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)) {
    throw new Error('target_not_typable');
  }
  if (step.clear || (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    el.value = '';
  }
  if (el.isContentEditable) {
    el.textContent = step.value ?? '';
  } else {
    el.value = step.value ?? '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

async function select(step, ctx) {
  const el = await findTarget(step.target, { timeoutMs: step.timeoutMs ?? 10000 });
  if (el.tagName.toLowerCase() === 'select') {
    const sel = el;
    const value = step.value;
    const label = step.label;
    let toSet = value;
    if (label != null) {
      const opt = Array.from(sel.options).find(o => o.text.trim() === label);
      if (!opt) throw new Error('option_not_found');
      toSet = opt.value;
    }
    if (toSet == null) throw new Error('select_requires_value_or_label');
    sel.value = toSet;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // Attempt to open a combobox-like control and choose an option by text
    el.click();
    await waitFor({ action: 'waitFor', text: step.label ?? step.value, timeoutMs: 5000 }, ctx);
    const opt = await findTarget({ text: step.label ?? step.value }, { timeoutMs: 3000 });
    opt.click();
  }
}

async function scroll(step, ctx) {
  if (step.target) {
    const el = await findTarget(step.target, { timeoutMs: step.timeoutMs ?? 10000 });
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (typeof step.y === 'number') {
    window.scrollTo({ top: step.y, behavior: step.behavior || 'smooth' });
  }
}

async function extract(step, ctx) {
  const el = await findTarget(step.target, { timeoutMs: step.timeoutMs ?? 10000 });
  if (step.as === 'text') return el.innerText.trim();
  if (step.as === 'list') return Array.from(el.querySelectorAll('li, [role="listitem"]')).map(x => x.innerText.trim());
  if (step.as === 'table') return tableToArray(el);
  return el.innerText.trim();
}

function tableToArray(root) {
  const rows = Array.from(root.querySelectorAll('tr'));
  return rows.map(r => Array.from(r.querySelectorAll('th,td')).map(c => c.innerText.trim()));
}

function labelFor(el) {
  return (el.getAttribute('aria-label') || el.innerText || el.getAttribute('name') || el.id || el.tagName).trim().slice(0, 80);
}

function defaultConfirm({ message }) {
  return Promise.resolve(window.confirm(message));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

