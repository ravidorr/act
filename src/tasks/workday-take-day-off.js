// Sample plan for the Workday "Take a day off next Monday" flow.
// This is intentionally high-level; selectors are resolved at runtime.

export const workdayTakeDayOffNextMonday = {
  task: 'Take a day off next Monday',
  steps: [
    { action: 'waitFor', urlIncludes: '/', timeoutMs: 20000 },
    // Open navigation menu (name contextual; adjust if needed)
    { action: 'click', target: { role: 'button', name: 'Menu' } },
    { action: 'click', target: { text: 'Absence' } },

    { action: 'waitFor', text: 'Request Absence', timeoutMs: 15000 },
    { action: 'click', target: { role: 'button', name: 'Request Absence' } },

    { action: 'waitFor', text: 'Select date range', timeoutMs: 15000 },
    { action: 'click', target: { role: 'button', name: 'Select date range' } },

    // From and To date picks are site-specific; for POC we assume combobox fields
    { action: 'click', target: { role: 'button', name: 'From' } },
    { action: 'click', target: { text: nextMondayLabel() } },

    { action: 'click', target: { role: 'button', name: 'To' } },
    { action: 'click', target: { text: nextMondayLabel() } },

    { action: 'waitFor', text: 'Type', timeoutMs: 10000 },
    { action: 'click', target: { role: 'combobox', name: 'Type' } },
    { action: 'click', target: { text: 'Flexible Time Off' } },

    { action: 'waitFor', text: 'Next', timeoutMs: 10000 },
    { action: 'click', target: { role: 'button', name: 'Next' } },

    // Human confirmation step for final Submit remains manual in the POC
  ]
};

function nextMondayLabel() {
  // Returns a label like "Mon 12" or "12" depending on calendar. Keep loose:
  const d = new Date();
  const day = d.getDay(); // 0-6 (Sun-Sat)
  const delta = (1 - day + 7) % 7 || 7; // next Monday
  const nm = new Date(Date.now() + delta * 24 * 60 * 60 * 1000);
  return String(nm.getDate());
}

