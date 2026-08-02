import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { Category, Expense, Tile, User } from '../models/index.js';
import { diffInDays, todayLocalDate } from '../utils/date.js';
import ApiError from '../utils/ApiError.js';
import { seedCategories } from './bootstrap.service.js';

const WRITE_CONCURRENCY = 25;
const LEGACY_TILE_BY_CATEGORY = {
  cigarettes: 'tile-cig',
  'food-drink': 'tile-food',
  transport: 'tile-transport',
  other: 'tile-extras',
};

const localSeedKey = (tileId) => {
  if (!tileId) return null;
  return tileId.startsWith('tile-') ? tileId.slice(5) : tileId;
};

/**
 * Derive account counters from authoritative, active expense rows.
 * Exported because streak edges (today, yesterday and gaps) are easy to
 * regress and can be tested without a database.
 */
export const summarizeExpenseDays = (days, today) => {
  if (!days.length) {
    return {
      totalTaps: 0,
      currentStreak: 0,
      longestStreak: 0,
      firstLoggedDate: null,
      lastLoggedDate: null,
    };
  }

  const sorted = [...days].sort((a, b) => a.localDate.localeCompare(b.localDate));
  let run = 0;
  let longest = 0;
  let previous = null;

  for (const day of sorted) {
    run = previous && diffInDays(previous, day.localDate) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day.localDate;
  }

  const firstLoggedDate = sorted[0].localDate;
  const lastLoggedDate = sorted.at(-1).localDate;
  const stillCurrent = diffInDays(lastLoggedDate, today) <= 1;

  return {
    totalTaps: sorted.reduce((sum, day) => sum + day.quantity, 0),
    currentStreak: stillCurrent ? run : 0,
    longestStreak: longest,
    firstLoggedDate,
    lastLoggedDate,
  };
};

const loadCategories = async (user, slugs) => {
  let categories = await Category.find({ user: user._id, slug: { $in: slugs } })
    .select('_id slug')
    .lean();

  // Legacy accounts may predate account bootstrapping. Seed only when a
  // requested category is missing; the operation is idempotent.
  if (categories.length < slugs.length) {
    await seedCategories(user);
    categories = await Category.find({ user: user._id, slug: { $in: slugs } })
      .select('_id slug')
      .lean();
  }

  return new Map(categories.map((category) => [category.slug, category._id]));
};

const loadTiles = async (user, tileIds) => {
  const objectIds = tileIds.filter((id) => mongoose.isObjectIdOrHexString(id));
  const seedKeys = tileIds.map(localSeedKey).filter(Boolean);
  const clauses = [];

  if (objectIds.length) clauses.push({ _id: { $in: objectIds } });
  if (seedKeys.length) clauses.push({ seedKey: { $in: seedKeys } });
  if (!clauses.length) return new Map();

  const tiles = await Tile.find({ user: user._id, $or: clauses })
    .select('_id seedKey')
    .lean();
  const byClientId = new Map();

  for (const tile of tiles) {
    byClientId.set(String(tile._id), tile._id);
    if (tile.seedKey) {
      byClientId.set(tile.seedKey, tile._id);
      byClientId.set(`tile-${tile.seedKey}`, tile._id);
    }
  }

  return byClientId;
};

const upsertExpense = async (user, expense, category, tile) => {
  const values = {
    tile: tile ?? null,
    clientTileId: expense.tileId ?? null,
    category,
    name: expense.name,
    note: expense.note ?? null,
    merchant: expense.merchant ?? null,
    unitAmountMinor: expense.unitAmountMinor,
    quantity: expense.quantity,
    totalAmountMinor: expense.unitAmountMinor * expense.quantity,
    currency: user.currency,
    occurredAt: new Date(expense.occurredAt),
    localDate: expense.localDate,
    localMonth: expense.localDate.slice(0, 7),
    source: expense.source,
    origin: { categorySource: tile ? 'tile' : 'user' },
    deletedAt: expense.deletedAt ? new Date(expense.deletedAt) : null,
  };

  const serverId = expense.clientId.match(/^server-([a-f\d]{24})$/i)?.[1];
  if (serverId) {
    const result = await Expense.updateOne(
      { _id: serverId, user: user._id },
      { $set: values },
      { runValidators: true }
    );
    if (result.matchedCount === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'That expense no longer exists');
    }
    return;
  }

  const filter = { user: user._id, clientId: expense.clientId };

  try {
    await Expense.updateOne(
      filter,
      { $set: values, $setOnInsert: { user: user._id, clientId: expense.clientId } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    // Two retries of the same offline item can race between the initial match
    // and the upsert. The unique clientId index picks one winner; the loser
    // then becomes an ordinary update instead of surfacing a false conflict.
    if (error?.code !== 11000) throw error;
    await Expense.updateOne(filter, { $set: values }, { runValidators: true });
  }
};

/** Full account snapshot for a newly signed-in device. */
export const listExpenses = async (user) => {
  const expenses = await Expense.find({ user: user._id })
    .sort({ occurredAt: 1, _id: 1 })
    .lean();

  if (!expenses.length) return [];

  const categoryIds = [...new Set(expenses.map((expense) => String(expense.category)))];
  const tileIds = [
    ...new Set(expenses.map((expense) => expense.tile && String(expense.tile)).filter(Boolean)),
  ];
  const [categories, tiles] = await Promise.all([
    Category.find({ user: user._id, _id: { $in: categoryIds } }).select('_id slug').lean(),
    tileIds.length
      ? Tile.find({ user: user._id, _id: { $in: tileIds } }).select('_id seedKey').lean()
      : [],
  ]);
  const categoryById = new Map(
    categories.map((category) => [String(category._id), category.slug])
  );
  const tileById = new Map(tiles.map((tile) => [String(tile._id), tile.seedKey]));

  return expenses.map((expense) => {
    const seedKey = expense.tile ? tileById.get(String(expense.tile)) : null;
    const categorySlug = categoryById.get(String(expense.category)) ?? 'other';
    const inferredTileId =
      expense.source === 'tap' ? LEGACY_TILE_BY_CATEGORY[categorySlug] ?? null : null;
    return {
      id: expense.clientId ?? `server-${expense._id}`,
      tileId:
        expense.clientTileId ?? (seedKey ? `tile-${seedKey}` : null) ?? inferredTileId,
      categorySlug,
      name: expense.name,
      ...(expense.note ? { note: expense.note } : {}),
      ...(expense.merchant ? { merchant: expense.merchant } : {}),
      unitAmountMinor: expense.unitAmountMinor,
      quantity: expense.quantity,
      totalAmountMinor: expense.totalAmountMinor,
      occurredAt: expense.occurredAt.toISOString(),
      localDate: expense.localDate,
      localMonth: expense.localMonth,
      source: expense.source,
      pendingSync: false,
      deletedAt: expense.deletedAt?.toISOString() ?? null,
    };
  });
};

const recomputeAccountRollups = async (user) => {
  const match = { user: user._id, deletedAt: null };
  const [dayRows, tileRows] = await Promise.all([
    Expense.aggregate([
      { $match: match },
      { $group: { _id: '$localDate', quantity: { $sum: '$quantity' } } },
      { $sort: { _id: 1 } },
    ]),
    Expense.aggregate([
      { $match: { ...match, tile: { $ne: null } } },
      {
        $group: {
          _id: '$tile',
          usageCount: { $sum: '$quantity' },
          lastUsedAt: { $max: '$occurredAt' },
        },
      },
    ]),
  ]);

  const stats = summarizeExpenseDays(
    dayRows.map((row) => ({ localDate: row._id, quantity: row.quantity })),
    todayLocalDate(user.timezone)
  );

  await Promise.all([
    User.updateOne(
      { _id: user._id },
      { $set: { stats, lastActiveAt: new Date() } }
    ),
    Tile.updateMany(
      { user: user._id },
      { $set: { usageCount: 0, lastUsedAt: null } }
    ),
  ]);

  if (tileRows.length) {
    await Tile.bulkWrite(
      tileRows.map((row) => ({
        updateOne: {
          filter: { _id: row._id, user: user._id },
          update: {
            $set: { usageCount: row.usageCount, lastUsedAt: row.lastUsedAt },
          },
        },
      }))
    );
  }
};

/**
 * Idempotently apply a client queue. Unknown local-only tiles remain nullable
 * on the server; category ownership and every write are always scoped to the
 * authenticated user.
 */
export const syncExpenses = async (user, expenses) => {
  const slugs = [...new Set(expenses.map((expense) => expense.categorySlug))];
  const tileIds = [
    ...new Set(expenses.map((expense) => expense.tileId).filter(Boolean)),
  ];

  const [categoryBySlug, tileByClientId] = await Promise.all([
    loadCategories(user, slugs),
    loadTiles(user, tileIds),
  ]);

  const failed = [];
  const writable = expenses.filter((expense) => {
    if (categoryBySlug.has(expense.categorySlug)) return true;
    failed.push(expense.clientId);
    return false;
  });

  // Bound database pressure without making a long-offline queue artificially
  // fail. Any database error aborts the response; already-written items are
  // safe to replay because clientId is idempotent.
  for (let index = 0; index < writable.length; index += WRITE_CONCURRENCY) {
    const chunk = writable.slice(index, index + WRITE_CONCURRENCY);
    await Promise.all(
      chunk.map((expense) =>
        upsertExpense(
          user,
          expense,
          categoryBySlug.get(expense.categorySlug),
          tileByClientId.get(expense.tileId) ?? null
        )
      )
    );
  }

  if (writable.length) await recomputeAccountRollups(user);

  return {
    synced: writable.map((expense) => expense.clientId),
    failed,
  };
};

export default { listExpenses, syncExpenses };
