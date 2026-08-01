// Development seed: creates a demo account with the design board's data so the
// screens can be built against something real.
//
//   npm run seed              → create/refresh the demo account
//   npm run seed -- --fresh   → delete its data first
//
// Credentials: demo@tally.app / tally1234
import env from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import {
  Budget,
  Category,
  Expense,
  Goal,
  Habit,
  Tile,
  User,
} from '../models/index.js';
import { bootstrapAccount, seedHabits } from '../services/bootstrap.service.js';
import { currentLocalMonth, lastNLocalDates, toLocalMonth } from '../utils/date.js';

const DEMO_EMAIL = 'demo@tally.app';
const DEMO_PASSWORD = 'tally1234';
const fresh = process.argv.includes('--fresh');

// Counts per tile per day across the last 30 days, shaped to look like the
// design's trend: heavier weekends, a data pack partway through.
const buildHistory = (tiles, categories, user) => {
  const dates = lastNLocalDates(30, user.timezone);
  const bySeed = new Map(tiles.map((t) => [t.seedKey, t]));
  const rows = [];

  dates.forEach((localDate, dayIndex) => {
    const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay();
    const isWeekend = weekday === 5 || weekday === 6; // Fri–Sat

    const plan = [
      ['tea', 3 + (dayIndex % 4)],
      ['cig', isWeekend ? 13 : 7 + (dayIndex % 5)],
      ['rick', isWeekend ? 4 : 2],
      ['lunch', 1],
      ['coffee', isWeekend ? 1 : 0],
      ['data', dayIndex === 16 ? 1 : 0],
    ];

    for (const [seedKey, quantity] of plan) {
      if (!quantity) continue;
      const tile = bySeed.get(seedKey);
      if (!tile) continue;

      rows.push({
        user: user._id,
        tile: tile._id,
        category: tile.category,
        name: tile.name,
        unitAmountMinor: tile.defaultAmountMinor,
        quantity,
        totalAmountMinor: tile.defaultAmountMinor * quantity,
        currency: user.currency,
        occurredAt: new Date(`${localDate}T12:30:00Z`),
        localDate,
        localMonth: toLocalMonth(`${localDate}T12:30:00Z`, user.timezone),
        source: 'tap',
        origin: { categorySource: 'tile' },
      });
    }
  });

  return rows;
};

const run = async () => {
  await connectDB();
  console.log(`Seeding against ${env.MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);

  // Drop and rebuild any index whose definition has drifted from the schema.
  // `autoIndex` only *creates* missing indexes — it silently leaves a stale one
  // in place when its options change, which is exactly how a wrong uniqueness
  // rule survives a fix.
  for (const model of [User, Category, Tile, Expense, Budget, Habit, Goal]) {
    await model.syncIndexes();
  }
  console.log('Indexes synced');

  let user = await User.findByEmail(DEMO_EMAIL);

  if (!user) {
    user = await User.create({
      email: DEMO_EMAIL,
      passwordHash: DEMO_PASSWORD, // hashed by the pre-save hook
      displayName: 'Rafi Hasan',
      currency: env.DEFAULT_CURRENCY,
      timezone: env.DEFAULT_TIMEZONE,
      onboarding: { completed: true, step: 3, completedAt: new Date() },
    });
    console.log('Created demo user');
  } else if (fresh) {
    await Promise.all([
      Expense.deleteMany({ user: user._id }),
      Tile.deleteMany({ user: user._id }),
      Category.deleteMany({ user: user._id }),
      Budget.deleteMany({ user: user._id }),
      Habit.deleteMany({ user: user._id }),
      Goal.deleteMany({ user: user._id }),
    ]);
    console.log('Cleared existing demo data');
  }

  // ৳18,000 a month — the design's budget, in poisha.
  const { categories, tiles } = await bootstrapAccount(user, {
    monthlyBudgetMinor: 1_800_000,
  });

  const habitTiles = tiles.filter((t) => ['cig', 'tea', 'rick'].includes(t.seedKey));
  const habits = await seedHabits(user, habitTiles);

  // Baselines the design quotes: 12 cigarettes, 6 teas, 2 rickshaws a day.
  const baselines = { cig: 12, tea: 6, rick: 2 };
  await Promise.all(
    habits.map((habit) => {
      const tile = tiles.find((t) => String(t._id) === String(habit.tile));
      const baseline = baselines[tile?.seedKey] ?? 0;
      habit.baselineDailyCount = baseline;
      habit.targetDailyCount = tile?.seedKey === 'cig' ? 8 : null;
      habit.baselineComputedAt = new Date();
      return habit.save();
    })
  );

  const existingExpenses = await Expense.countDocuments({ user: user._id });
  if (!existingExpenses) {
    const rows = buildHistory(tiles, categories, user);
    await Expense.insertMany(rows);
    console.log(`Inserted ${rows.length} expense rows across 30 days`);
  } else {
    console.log(`Kept ${existingExpenses} existing expense rows (use --fresh to reset)`);
  }

  const cigHabit = habits.find((h) => h.name === 'Cigarette');
  if (cigHabit) {
    await Goal.findOneAndUpdate(
      { user: user._id, title: 'A new phone by March' },
      {
        $setOnInsert: {
          user: user._id,
          title: 'A new phone by March',
          targetAmountMinor: 4_200_000, // ৳42,000
          savedAmountMinor: 729_600, // ৳7,296
          currency: user.currency,
          linkedHabit: cigHabit._id,
          reductionPerDay: 4,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const totals = await Expense.aggregate([
    { $match: { user: user._id, deletedAt: null, localMonth: currentLocalMonth(user.timezone) } },
    { $group: { _id: null, total: { $sum: '$totalAmountMinor' }, rows: { $sum: 1 } } },
  ]);

  console.log('\nDemo account ready');
  console.log(`  email     ${DEMO_EMAIL}`);
  console.log(`  password  ${DEMO_PASSWORD}`);
  console.log(`  tiles     ${tiles.length}`);
  console.log(`  habits    ${habits.length}`);
  console.log(`  month     ${totals[0]?.rows ?? 0} rows, ${(totals[0]?.total ?? 0) / 100} ${user.currency}`);

  await disconnectDB();
};

run().catch(async (error) => {
  console.error('Seed failed:', error);
  await disconnectDB();
  process.exit(1);
});
