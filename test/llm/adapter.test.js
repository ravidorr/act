import { afterEach, describe, expect, it } from 'vitest';

import { loadRecordedPlan, planFromText } from '../../src/llm/adapter.js';
import { workdayTakeDayOffNextMonday } from '../../src/tasks/workday-take-day-off.js';

afterEach(() => {
  localStorage.clear();
});

describe('planFromText', () => {
  it('accepts text as its only declared argument', () => {
    expect(planFromText).toHaveLength(1);
  });

  it('routes absence requests for next Monday to the sample plan', async () => {
    await expect(planFromText('I need a VACATION next Monday')).resolves.toBe(workdayTakeDayOffNextMonday);
  });

  it('returns a valid recorded plan only for a run-recording request', async () => {
    const saved = { task: 'Recorded', steps: [{ action: 'click', target: { text: 'Start' } }] };
    localStorage.setItem('pact.recorder.plan', JSON.stringify(saved));

    await expect(planFromText('Please execute the recorded plan')).resolves.toEqual(saved);
    await expect(planFromText('What did I record?')).resolves.toBeNull();
  });

  it('returns no plan for unsupported, empty, or missing text', async () => {
    await expect(planFromText('Open the dashboard')).resolves.toBeNull();
    await expect(planFromText('')).resolves.toBeNull();
    await expect(planFromText(null)).resolves.toBeNull();
  });
});

describe('loadRecordedPlan', () => {
  it('returns null when a recording is missing, malformed, or lacks steps', () => {
    expect(loadRecordedPlan()).toBeNull();

    localStorage.setItem('pact.recorder.plan', '{bad json');
    expect(loadRecordedPlan()).toBeNull();

    localStorage.setItem('pact.recorder.plan', JSON.stringify({ task: 'Incomplete' }));
    expect(loadRecordedPlan()).toBeNull();
  });

  it('accepts a recording with an array of steps', () => {
    const saved = { task: 'Recorded', steps: [] };
    localStorage.setItem('pact.recorder.plan', JSON.stringify(saved));

    expect(loadRecordedPlan()).toEqual(saved);
  });
});
