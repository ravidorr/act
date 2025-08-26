// Simple LLM adapter placeholder.
// Later, swap this with a real/local model. For now, do lightweight heuristics.

import { workdayTakeDayOffNextMonday } from '../tasks/workday-take-day-off.js';

export async function planFromText(text, context = {}) {
  const t = (text || '').toLowerCase();

  // Heuristic routing
  if (/(day\s*off|absence|vacation).*(next\s*monday)/.test(t)) {
    return workdayTakeDayOffNextMonday;
  }

  // Check for a locally recorded plan (fast iteration)
  const saved = loadRecordedPlan();
  if (saved && /(run|execute).*(record(ed)?\s*plan|recording)/.test(t)) {
    return saved;
  }

  // Default: no plan
  return null;
}

export function loadRecordedPlan() {
  try {
    const raw = localStorage.getItem('pact.recorder.plan');
    if (!raw) return null;
    const plan = JSON.parse(raw);
    if (plan && Array.isArray(plan.steps)) return plan;
  } catch {}
  return null;
}

