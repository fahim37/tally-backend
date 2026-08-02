import test from 'node:test';
import assert from 'node:assert/strict';
import { syncAccountStateSchema } from '../validators/accountState.validator.js';

const validSections = {
  profile: {
    displayName: 'Fahim',
    currency: 'BDT',
    appearance: 'system',
    onboardingCompleted: true,
  },
  settings: { strikeAt: 5, longPressMs: 430, pressDepth: 3 },
  budgets: [
    {
      month: '2026-08',
      overallLimitMinor: 1_800_000,
      categoryLimits: [{ categorySlug: 'food-drink', limitMinor: 500_000 }],
    },
  ],
  tiles: [
    {
      id: 'tile-food',
      name: 'Food',
      iconKey: 'lunch',
      categorySlug: 'food-drink',
      defaultAmountMinor: 5_000,
      presetAmountsMinor: [2_000, 5_000],
      entry: 'prompt',
      sortIndex: 0,
      isArchived: false,
      isCustom: false,
    },
  ],
};

test('accepts independently syncable account sections', () => {
  const parsed = syncAccountStateSchema.parse({ sections: validSections });
  assert.equal(parsed.sections.budgets[0].overallLimitMinor, 1_800_000);
  assert.equal(parsed.sections.tiles[0].id, 'tile-food');
});

test('accepts one section without requiring a full snapshot', () => {
  const parsed = syncAccountStateSchema.parse({ sections: { settings: validSections.settings } });
  assert.equal(parsed.sections.settings.strikeAt, 5);
});

test('rejects empty, unknown, and malformed sections', () => {
  assert.equal(syncAccountStateSchema.safeParse({ sections: {} }).success, false);
  assert.equal(
    syncAccountStateSchema.safeParse({ sections: { secret: true } }).success,
    false
  );
  assert.equal(
    syncAccountStateSchema.safeParse({
      sections: { budgets: [{ ...validSections.budgets[0], month: '2026-13' }] },
    }).success,
    false
  );
});
