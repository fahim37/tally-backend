import { Budget, Category, Habit, Tile } from '../models/index.js';
import { DEFAULT_CATEGORIES } from '../constants/categories.js';
import { DEFAULT_TILES } from '../constants/tiles.js';
import { currentLocalMonth } from '../utils/date.js';

/**
 * Everything a brand-new account needs to have a working Tap Pad on first
 * open. Signup stays two fields because this runs behind it — the user lands
 * on a populated home screen, and onboarding only *revises* these defaults
 * (currency, budget, which tiles to keep) rather than being required to
 * produce them.
 *
 * Idempotent: safe to re-run for an existing user (the seed script relies on
 * that), because categories key on `slug` and tiles on `seedKey`.
 */
export const bootstrapAccount = async (user, { monthlyBudgetMinor = null } = {}) => {
  const categories = await seedCategories(user);
  const tiles = await seedTiles(user, categories);
  const budget = monthlyBudgetMinor
    ? await seedBudget(user, monthlyBudgetMinor)
    : null;

  return { categories, tiles, budget };
};

export const seedCategories = async (user) => {
  const operations = DEFAULT_CATEGORIES.map((category) => ({
    updateOne: {
      filter: { user: user._id, slug: category.slug },
      update: { $setOnInsert: { ...category, user: user._id } },
      upsert: true,
    },
  }));

  await Category.bulkWrite(operations);
  return Category.find({ user: user._id }).sort({ sortIndex: 1 });
};

export const seedTiles = async (user, categories) => {
  const bySlug = new Map(categories.map((c) => [c.slug, c._id]));

  const operations = DEFAULT_TILES.map((tile) => {
    const { key, categorySlug, suggestedInOnboarding, ...rest } = tile;
    return {
      updateOne: {
        filter: { user: user._id, seedKey: key },
        update: {
          $setOnInsert: {
            ...rest,
            user: user._id,
            seedKey: key,
            category: bySlug.get(categorySlug),
            isCustom: false,
          },
        },
        upsert: true,
      },
    };
  });

  await Tile.bulkWrite(operations);
  return Tile.find({ user: user._id }).sort({ sortIndex: 1 });
};

export const seedBudget = async (user, overallLimitMinor) => {
  const month = currentLocalMonth(user.timezone);
  return Budget.findOneAndUpdate(
    { user: user._id, month },
    {
      $setOnInsert: {
        user: user._id,
        month,
        overallLimitMinor,
        currency: user.currency,
        categoryLimits: [],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * Promotes tiles to habit cards. Called at the end of onboarding with whatever
 * the user picked; the Habits screen shows one card per row created here.
 */
export const seedHabits = async (user, tiles) => {
  const operations = tiles.map((tile, index) => ({
    updateOne: {
      filter: { user: user._id, tile: tile._id },
      update: {
        $setOnInsert: {
          user: user._id,
          tile: tile._id,
          name: tile.name,
          unitAmountMinor: tile.defaultAmountMinor,
          sortIndex: index,
        },
      },
      upsert: true,
    },
  }));

  if (!operations.length) return [];
  await Habit.bulkWrite(operations);
  return Habit.find({ user: user._id }).sort({ sortIndex: 1 });
};
