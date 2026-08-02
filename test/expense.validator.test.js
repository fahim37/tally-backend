import test from 'node:test';
import assert from 'node:assert/strict';
import { syncExpensesSchema } from '../validators/expense.validator.js';

const expense = (overrides = {}) => ({
  clientId: 'exp-local-1',
  tileId: 'tile-cig',
  categorySlug: 'cigarettes',
  name: 'Cigarette',
  unitAmountMinor: 1600,
  quantity: 2,
  occurredAt: '2026-08-02T06:00:00.000Z',
  localDate: '2026-08-02',
  source: 'tap',
  deletedAt: null,
  ...overrides,
});

test('accepts the frontend expense sync shape', () => {
  const parsed = syncExpensesSchema.parse({ expenses: [expense()] });
  assert.equal(parsed.expenses[0].clientId, 'exp-local-1');
  assert.equal(parsed.expenses[0].deletedAt, null);
});

test('rejects duplicate client ids in one batch', () => {
  const result = syncExpensesSchema.safeParse({
    expenses: [expense(), expense({ quantity: 3 })],
  });
  assert.equal(result.success, false);
});

test('rejects impossible calendar dates and unsafe totals', () => {
  assert.equal(
    syncExpensesSchema.safeParse({
      expenses: [expense({ localDate: '2026-02-31' })],
    }).success,
    false
  );
  assert.equal(
    syncExpensesSchema.safeParse({
      expenses: [
        expense({ unitAmountMinor: Number.MAX_SAFE_INTEGER, quantity: 2 }),
      ],
    }).success,
    false
  );
});
