import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeExpenseDays } from '../services/expense.service.js';

test('summarizes totals and consecutive days', () => {
  const stats = summarizeExpenseDays(
    [
      { localDate: '2026-07-29', quantity: 2 },
      { localDate: '2026-08-01', quantity: 3 },
      { localDate: '2026-08-02', quantity: 4 },
    ],
    '2026-08-02'
  );

  assert.deepEqual(stats, {
    totalTaps: 9,
    currentStreak: 2,
    longestStreak: 2,
    firstLoggedDate: '2026-07-29',
    lastLoggedDate: '2026-08-02',
  });
});

test('keeps a yesterday streak current and expires older streaks', () => {
  const yesterday = summarizeExpenseDays(
    [{ localDate: '2026-08-01', quantity: 1 }],
    '2026-08-02'
  );
  const old = summarizeExpenseDays(
    [{ localDate: '2026-07-31', quantity: 1 }],
    '2026-08-02'
  );

  assert.equal(yesterday.currentStreak, 1);
  assert.equal(old.currentStreak, 0);
});

test('returns zeroed stats for an empty account', () => {
  assert.deepEqual(summarizeExpenseDays([], '2026-08-02'), {
    totalTaps: 0,
    currentStreak: 0,
    longestStreak: 0,
    firstLoggedDate: null,
    lastLoggedDate: null,
  });
});
