// UI widget: launcher + panel + simple chat/quick actions.
// Note: styling lives in styles/act-widget.css per the no-inline-CSS rule.

import { runPlan as run } from '../agent/core.js';
import { workdayTakeDayOffNextMonday as samplePlan } from '../tasks/workday-take-day-off.js';
import { planFromText, loadRecordedPlan } from '../llm/adapter.js';

export function createWidget({ runPlan = run, plans = { samplePlan }, allowlist = [/.*/] } = {}) {
  const state = { open: false, running: false, controller: null };

  // Root container
  const root = document.createElement('div');
  root.className = 'pact-root';
  root.setAttribute('data-pact', 'root');

  // Launcher button
  const launcher = document.createElement('button');
  launcher.className = 'pact-launcher';
  launcher.type = 'button';
  launcher.textContent = 'Act';
  root.appendChild(launcher);

  // Panel
  const panel = document.createElement('div');
  panel.className = 'pact-panel pact-hidden';
  panel.innerHTML = `
    <div class="pact-header">
      <div class="pact-title">Pendo Act (POC)</div>
      <div class="pact-tools">
        <button class="pact-record" type="button" aria-pressed="false">● Record</button>
        <button class="pact-save" type="button">Save</button>
        <button class="pact-run-recording" type="button">Run Recording</button>
        <button class="pact-clear-recording" type="button">Clear</button>
        <button class="pact-close" type="button" aria-label="Close">×</button>
      </div>
    </div>
    <div class="pact-body">
      <div class="pact-quick">
        <button class="pact-quick-btn" data-action="workday-dayoff">Take a day off next Monday</button>
      </div>
      <div class="pact-chat">
        <form class="pact-form">
          <input class="pact-input" name="q" placeholder="Describe what to do…" autocomplete="off" />
          <button class="pact-run" type="submit">Run</button>
          <button class="pact-stop" type="button">Stop</button>
        </form>
      </div>
      <div class="pact-log" aria-live="polite"></div>
    </div>
  `;
  root.appendChild(panel);

  document.body.appendChild(root);

  const closeBtn = panel.querySelector('.pact-close');
  const log = panel.querySelector('.pact-log');
  const form = panel.querySelector('.pact-form');
  const input = panel.querySelector('.pact-input');
  const runBtn = panel.querySelector('.pact-run');
  const stopBtn = panel.querySelector('.pact-stop');

  // Recorder controls
  const recordBtn = panel.querySelector('.pact-record');
  const saveBtn = panel.querySelector('.pact-save');
  const runRecordingBtn = panel.querySelector('.pact-run-recording');
  const clearRecordingBtn = panel.querySelector('.pact-clear-recording');

  function open() {
    state.open = true;
    panel.classList.remove('pact-hidden');
  }
  function close() {
    state.open = false;
    panel.classList.add('pact-hidden');
  }
  function toggle() { state.open ? close() : open(); }

  launcher.addEventListener('click', toggle);
  closeBtn.addEventListener('click', close);

  panel.querySelector('.pact-quick-btn').addEventListener('click', async () => {
    await runTask(samplePlan);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const plan = await planFromText(text, { plans: { samplePlan } });
    if (plan) {
      await runTask(plan);
    } else {
      appendLog('Planner', 'No matching plan. Try: "Take a day off next Monday" or "Run recorded plan"');
    }
  });

  stopBtn.addEventListener('click', () => {
    if (state.controller) state.controller.abort();
  });

  // Recorder implementation
  const recorder = { enabled: false, steps: [], handlers: [] };

  recordBtn.addEventListener('click', () => {
    recorder.enabled ? stopRecorder() : startRecorder();
  });
  saveBtn.addEventListener('click', () => saveRecording());
  runRecordingBtn.addEventListener('click', async () => {
    const plan = loadRecordedPlan();
    if (!plan) return appendLog('Recorder', 'No recording found in localStorage');
    await runTask(plan);
  });
  clearRecordingBtn.addEventListener('click', () => {
    localStorage.removeItem('pact.recorder.plan');
    appendLog('Recorder', 'Cleared saved recording');
  });

  function startRecorder() {
    recorder.enabled = true;
    recordBtn.setAttribute('aria-pressed', 'true');
    recordBtn.classList.add('pact-recording');
    appendLog('Recorder', 'Recording started');

    const onClick = (e) => {
      if (!recorder.enabled) return;
      const el = e.target;
      if (el.closest('.pact-root')) return; // ignore widget
      const target = toTarget(el);
      recorder.steps.push({ action: 'click', target });
      highlight(el);
    };
    const onChange = (e) => {
      if (!recorder.enabled) return;
      const el = e.target;
      if (el.closest('.pact-root')) return;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)) return;
      const target = toTarget(el);
      const value = el.isContentEditable ? (el.textContent || '') : (el.value || '');
      recorder.steps.push({ action: 'type', target, value });
      highlight(el);
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    recorder.handlers = [ ['click', onClick], ['change', onChange] ];
  }

  function stopRecorder() {
    recorder.enabled = false;
    recordBtn.setAttribute('aria-pressed', 'false');
    recordBtn.classList.remove('pact-recording');
    for (const [type, fn] of recorder.handlers) document.removeEventListener(type, fn, true);
    recorder.handlers = [];
    appendLog('Recorder', `Recording stopped. Steps: ${recorder.steps.length}. Click Save to persist.`);
  }

  function saveRecording() {
    const plan = {
      task: 'Recorded Task',
      steps: recorder.steps.slice()
    };
    localStorage.setItem('pact.recorder.plan', JSON.stringify(plan));
    appendLog('Recorder', 'Saved to localStorage under key: pact.recorder.plan');
  }

  function toTarget(el) {
    return {
      selector: cssPath(el),
      role: el.getAttribute('role') || undefined,
      name: el.getAttribute('aria-label') || undefined,
      text: (el.innerText || '').trim().slice(0, 60) || undefined,
      placeholder: (el.placeholder || undefined)
    };
  }

  function highlight(el) {
    el.classList.add('pact-recorder-highlight');
    setTimeout(() => el.classList.remove('pact-recorder-highlight'), 300);
  }

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id) return `#${el.id}`;
    if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
    const parts = [];
    while (el && el.nodeType === 1 && parts.length < 4 && !el.id && !el.getAttribute('data-testid')) {
      let selector = el.nodeName.toLowerCase();
      if (el.className) {
        const cls = String(el.className).trim().split(/\s+/).slice(0,2).join('.');
        if (cls) selector += `.${cls}`;
      }
      const parent = el.parentNode;
      if (!parent) break;
      const siblings = Array.from(parent.children).filter(c => c.nodeName === el.nodeName);
      if (siblings.length > 1) selector += `:nth-of-type(${1 + siblings.indexOf(el)})`;
      parts.unshift(selector);
      el = parent;
      if (el.id) parts.unshift(`#${el.id}`);
    }
    return parts.join(' > ');
  }

  function appendLog(source, message) {
    const item = document.createElement('div');
    item.className = 'pact-log-item';
    item.textContent = `[${source}] ${message}`;
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }

  async function confirm({ message }) {
    return await new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'pact-confirm';
      wrap.innerHTML = `
        <div class="pact-confirm-box" role="dialog" aria-modal="true">
          <div class="pact-confirm-msg"></div>
          <div class="pact-confirm-actions">
            <button class="pact-btn-yes" type="button">Confirm</button>
            <button class="pact-btn-no" type="button">Cancel</button>
          </div>
        </div>
      `;
      wrap.querySelector('.pact-confirm-msg').textContent = message;
      const yes = wrap.querySelector('.pact-btn-yes');
      const no = wrap.querySelector('.pact-btn-no');
      yes.addEventListener('click', () => { cleanup(); resolve(true); });
      no.addEventListener('click', () => { cleanup(); resolve(false); });
      document.body.appendChild(wrap);
      function cleanup() { wrap.remove(); }
    });
  }

  async function runTask(plan) {
    if (state.running) return;
    state.running = true;
    runBtn.disabled = true;
    stopBtn.disabled = false;

    state.controller = new AbortController();
    const startedAt = Date.now();

    appendLog('Agent', `Starting task: ${plan.task}`);

    try {
      await runPlan(plan, {
        allowlist,
        confirm,
        signal: state.controller.signal,
        onEvent: (e) => {
          if (e.type === 'step:start') appendLog('Step', `#${e.i + 1} ${e.step.action}`);
          if (e.type === 'step:success') appendLog('Step', `#${e.i + 1} ✓`);
          if (e.type === 'step:fail') appendLog('Error', `#${e.i + 1} ${e.error}`);
          if (e.type === 'plan:success') appendLog('Agent', `Done in ${Math.round((Date.now() - startedAt)/1000)}s`);
        }
      });
    } catch (err) {
      if (String(err) === 'Error: aborted' || String(err) === 'aborted') {
        appendLog('Agent', 'Stopped by user');
      } else {
        appendLog('Agent', `Failed: ${String(err)}`);
      }
    } finally {
      state.running = false;
      runBtn.disabled = false;
      stopBtn.disabled = true;
      state.controller = null;
    }
  }

  // Auto-open in demo environments
  setTimeout(() => { /* open(); */ }, 0);

  return { open, close, toggle, runTask, appendLog };
}

