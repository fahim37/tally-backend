// The starter Tap Pad. Seeded on signup so the home screen is usable on first
// open — the onboarding "what do you buy most days?" step just toggles which
// of these stay active and lets the user add their own.
//
// Amounts are minor units (poisha): 2000 = ৳20. These mirror the design board's
// tile values exactly.
import { CATEGORY_SLUGS } from './categories.js';

export const DEFAULT_TILES = [
  {
    key: 'tea',
    name: 'Tea',
    iconKey: 'tea',
    defaultAmountMinor: 2000,
    presetAmountsMinor: [2000, 4000, 10000, 20000],
    categorySlug: CATEGORY_SLUGS.FOOD,
    sortIndex: 0,
    suggestedInOnboarding: true,
  },
  {
    key: 'cig',
    name: 'Cigarette',
    iconKey: 'cig',
    defaultAmountMinor: 1600,
    presetAmountsMinor: [1600, 3200, 8000, 16000],
    categorySlug: CATEGORY_SLUGS.CIGARETTES,
    sortIndex: 1,
    suggestedInOnboarding: true,
  },
  {
    key: 'rick',
    name: 'Rickshaw',
    iconKey: 'rick',
    defaultAmountMinor: 5000,
    presetAmountsMinor: [5000, 10000, 25000, 50000],
    categorySlug: CATEGORY_SLUGS.TRANSPORT,
    sortIndex: 2,
    suggestedInOnboarding: true,
  },
  {
    key: 'lunch',
    name: 'Lunch',
    iconKey: 'lunch',
    defaultAmountMinor: 15000,
    presetAmountsMinor: [15000, 30000, 75000, 150000],
    categorySlug: CATEGORY_SLUGS.FOOD,
    sortIndex: 3,
    suggestedInOnboarding: true,
  },
  {
    key: 'data',
    name: 'Data pack',
    iconKey: 'data',
    defaultAmountMinor: 30000,
    presetAmountsMinor: [30000, 60000, 150000, 300000],
    categorySlug: CATEGORY_SLUGS.BILLS,
    sortIndex: 4,
    suggestedInOnboarding: false,
  },
  {
    key: 'coffee',
    name: 'Coffee',
    iconKey: 'coffee',
    defaultAmountMinor: 25000,
    presetAmountsMinor: [25000, 50000, 125000, 250000],
    categorySlug: CATEGORY_SLUGS.FOOD,
    sortIndex: 5,
    suggestedInOnboarding: false,
  },
];

/**
 * Preset ladder for a custom tile — the long-press sheet shows four amounts.
 * The design derives them as base, ×2, ×5, ×10.
 */
export const presetsFor = (baseMinor) => [
  baseMinor,
  baseMinor * 2,
  baseMinor * 5,
  baseMinor * 10,
];
