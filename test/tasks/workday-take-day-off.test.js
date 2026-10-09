import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadPlanAt(date) {
  vi.useFakeTimers();
  vi.setSystemTime(date);
  vi.resetModules();
  return import('../../src/tasks/workday-take-day-off.js');
}

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

describe('workdayTakeDayOffNextMonday', () => {
  it('builds the complete high-level Workday flow for a Monday', async () => {
    const { workdayTakeDayOffNextMonday: plan } = await loadPlanAt(new Date('2026-10-12T12:00:00'));

    expect(plan.task).toBe('Take a day off next Monday');
    expect(plan.steps).toHaveLength(16);
    expect(plan.steps[0]).toEqual({ action: 'waitFor', urlIncludes: '/', timeoutMs: 20000 });
    expect(plan.steps[1].target).toEqual({ role: 'button', name: 'Menu' });
    expect(plan.steps[7].target).toEqual({ role: 'button', name: 'From' });
    expect(plan.steps[8].target).toEqual({ text: '19' });
    expect(plan.steps[10].target).toEqual({ text: '19' });
    expect(plan.steps.at(-1).target).toEqual({ role: 'button', name: 'Next' });
  });

  it('uses the immediately following Monday when today is Sunday', async () => {
    const { workdayTakeDayOffNextMonday: plan } = await loadPlanAt(new Date('2026-10-11T12:00:00'));

    expect(plan.steps[8].target).toEqual({ text: '12' });
    expect(plan.steps[10].target).toEqual({ text: '12' });
  });
});
