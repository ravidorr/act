// Safety: allowlist enforcement and confirmation heuristics.

export function isAllowedUrl(url, allowlist) {
  try {
    const u = new URL(url);
    const full = u.toString();
    return allowlist.some(rx => rx.test(full));
  } catch {
    return false;
  }
}

export function requiresConfirmation(el) {
  const tag = el.tagName.toLowerCase();
  const txt = (el.getAttribute('aria-label') || el.innerText || '').toLowerCase();
  const riskyWords = ['delete', 'remove', 'submit', 'pay', 'confirm', 'approve', 'purchase', 'transfer', 'save'];
  if (tag === 'button' || el.getAttribute('role') === 'button') {
    return riskyWords.some(w => txt.includes(w));
  }
  return false;
}

