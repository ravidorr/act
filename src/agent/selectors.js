// Target resolution helpers. Favor stable anchors first.

export async function findTarget(target, { timeoutMs = 8000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const scope = target?.within ? await findTarget(target.within, { timeoutMs: 1000 }) : document;
      const el = resolveOnce(scope, target);
      if (el) return el;
    } catch (e) {
      lastError = e;
    }
    await sleep(150);
  }
  throw lastError || new Error(`Target not found: ${JSON.stringify(target)}`);
}

function resolveOnce(scope, t = {}) {
  const candidates = [];
  if (t.testId) candidates.push(...scope.querySelectorAll(`[data-testid="${cssEscape(t.testId)}"]`));
  if (t.selector) candidates.push(...scope.querySelectorAll(t.selector));
  if (t.placeholder) candidates.push(...Array.from(scope.querySelectorAll('input,textarea')).filter(e => e.placeholder?.trim() === t.placeholder));
  if (t.role || t.name) candidates.push(...byAria(scope, t.role, t.name));
  if (t.text) candidates.push(...byText(scope, t.text));

  const el = pickBest(candidates, t);
  return el || null;
}

function byAria(scope, role, name) {
  let els = role ? Array.from(scope.querySelectorAll(`[role="${cssEscape(role)}"]`)) : Array.from(scope.querySelectorAll('button,a,input,textarea,select,[role]'));
  if (name) {
    const needle = norm(name);
    els = els.filter(e => norm(accessibleName(e)).includes(needle));
  }
  return els;
}

function byText(scope, text) {
  const needle = norm(text);
  const clickables = scope.querySelectorAll('button,a,[role="button"],[role="menuitem"],[role="option"],label,div,span');
  return Array.from(clickables).filter(e => norm(e.innerText).includes(needle));
}

function pickBest(candidates, t) {
  if (!candidates.length) return null;
  const scored = candidates.map(el => ({ el, score: score(el, t) }));
  scored.sort((a,b) => b.score - a.score);
  return scored[0].el;
}

function score(el, t) {
  let s = 0;
  if (t.testId && el.matches(`[data-testid="${cssEscape(t.testId)}"]`)) s += 10;
  if (t.selector && el.matches(t.selector)) s += 5;
  if (t.role && el.getAttribute('role') === t.role) s += 3;
  if (t.name && norm(accessibleName(el)).includes(norm(t.name))) s += 3;
  if (t.text && norm(el.innerText).includes(norm(t.text))) s += 2;
  if (t.placeholder && (el.placeholder?.trim() === t.placeholder)) s += 1;
  // prefer visible and in-viewport
  if (isVisible(el)) s += 2;
  if (inViewport(el)) s += 1;
  return s;
}

function accessibleName(el) {
  return el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.innerText || '';
}

function isVisible(el) {
  const style = getComputedStyle(el);
  return style && style.visibility !== 'hidden' && style.display !== 'none' && el.offsetParent !== null;
}

function inViewport(el) {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
}

function norm(s) { return (s || '').trim().toLowerCase(); }
function cssEscape(s) { return String(s).replace(/"/g, '\\"'); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

