import { z } from 'zod';
import { ICON_KEYS } from '../constants/icons.js';

const id = z.string().trim().min(1).max(128);
const iconKey = z.enum(ICON_KEYS);
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const count = z.number().int().nonnegative().max(1_000_000);
const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'date must be a real calendar date');
const localMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM');

const profile = z
  .object({
    displayName: z.string().trim().max(60),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
    appearance: z.enum(['light', 'dark', 'system']),
    onboardingCompleted: z.boolean(),
  })
  .strict();

const settings = z
  .object({
    strikeAt: z.number().int().min(4).max(6),
    longPressMs: z.number().int().min(150).max(2_000),
    pressDepth: z.number().int().min(0).max(12),
  })
  .strict();

const category = z
  .object({
    id,
    slug,
    name: z.string().trim().min(1).max(60),
    colorVar: z.string().trim().min(1).max(80),
    iconKey,
    keywords: z.array(z.string().trim().min(1).max(80)).max(200),
    sortIndex: z.number().int().min(0).max(10_000),
  })
  .strict();

const tile = z
  .object({
    id,
    name: z.string().trim().min(1).max(32),
    iconKey,
    categorySlug: slug,
    defaultAmountMinor: amount,
    presetAmountsMinor: z.array(amount).max(20),
    entry: z.enum(['instant', 'prompt']),
    sortIndex: z.number().int().min(0).max(10_000),
    isArchived: z.boolean(),
    isCustom: z.boolean(),
  })
  .strict();

const categoryLimit = z
  .object({ categorySlug: slug, limitMinor: amount })
  .strict();

const budget = z
  .object({
    month: localMonth,
    overallLimitMinor: amount,
    categoryLimits: z.array(categoryLimit).max(100),
  })
  .strict();

const habit = z
  .object({
    id,
    tileId: id,
    name: z.string().trim().min(1).max(32),
    iconKey,
    unitAmountMinor: amount,
    baselineDailyCount: count,
    targetDailyCount: count.nullable(),
    whatIfDailyCount: count.nullable(),
    sortIndex: z.number().int().min(0).max(10_000),
  })
  .strict();

const goal = z
  .object({
    id,
    title: z.string().trim().min(1).max(80),
    note: z.string().trim().max(280),
    targetAmountMinor: amount,
    savedAmountMinor: amount,
    linkedHabitId: id.nullable(),
    reductionPerDay: count.nullable(),
    targetDate: localDate.nullable(),
  })
  .strict();

const recurring = z
  .object({
    id,
    name: z.string().trim().min(1).max(80),
    categorySlug: slug,
    amountMinor: amount,
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    dayOfMonth: z.number().int().min(1).max(31).nullable(),
    nextRunDate: localDate,
    lastRunDate: localDate.nullable(),
    autoLog: z.boolean(),
    isActive: z.boolean(),
  })
  .strict();

export const accountSectionsSchema = z
  .object({
    profile: profile.optional(),
    settings: settings.optional(),
    categories: z.array(category).max(100).optional(),
    tiles: z.array(tile).max(500).optional(),
    budgets: z.array(budget).max(240).optional(),
    habits: z.array(habit).max(500).optional(),
    goals: z.array(goal).max(500).optional(),
    recurring: z.array(recurring).max(500).optional(),
  })
  .strict()
  .refine((sections) => Object.keys(sections).length > 0, 'Send at least one section');

export const syncAccountStateSchema = z
  .object({ sections: accountSectionsSchema })
  .strict();

export default syncAccountStateSchema;
