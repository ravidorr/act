// Entry point for Pendo Act POC (JavaScript)
// Exposes a global PendoAct object when bundled as an IIFE via esbuild.

import { createWidget } from './ui/widget.js';
import { runPlan } from './agent/core.js';
import { workdayTakeDayOffNextMonday } from './tasks/workday-take-day-off.js';

function getBaseUrl() {
  // Try to infer from the currently executing script
  const script = document.currentScript || Array.from(document.getElementsByTagName('script')).find(s => s.src && s.src.includes('act-widget'));
  try {
    return script ? new URL('.', script.src).toString() : '';
  } catch {
    return '';
  }
}

function ensureStylesheet(href) {
  if (!href) return;
  const existing = Array.from(document.styleSheets).find(ss => ss.href === href);
  if (existing) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

export function boot(options = {}) {
  const baseUrl = options.baseUrl || getBaseUrl();
  ensureStylesheet(`${baseUrl}act-widget.css`);

  const allowlist = options.allowlist || [new RegExp('^' + escapeRegExp(location.origin))];
  const plans = {
    workdayTakeDayOffNextMonday,
    ...(options.plans || {})
  };

  const api = createWidget({
    runPlan,
    plans,
    allowlist,
  });

  return api;
}

export const version = '0.1.0';
export const plans = { workdayTakeDayOffNextMonday };

// Utility
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

