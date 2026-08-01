import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

/**
 * Recurring expenses that auto-log — rent, subscriptions, a data pack.
 *
 * A scheduler sweeps `nextRunAt <= now` on active rules and writes an Expense
 * with source 'recurring'. `nextRunAt` is stored as a real instant (computed
 * from the user's timezone) so the sweep is a single indexed query and does
 * not have to interpret local dates per user.
 *
 * `lastRunDate` makes the sweep idempotent: a rule that already produced a row
 * for that local date is skipped, so a retried or overlapping run cannot
 * double-charge the user.
 */
const recurringRuleSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    name: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    tile: { type: Schema.Types.ObjectId, ref: 'Tile', default: null },

    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true },

    frequency: { type: String, enum: FREQUENCIES, required: true },
    // Every N periods — interval 2 + 'weekly' is fortnightly.
    interval: { type: Number, default: 1, min: 1 },

    // 1–31 for monthly/yearly. A rule set to 31 lands on the last day of a
    // short month rather than skipping it.
    dayOfMonth: { type: Number, min: 1, max: 31, default: null },
    // 0 Sunday … 6 Saturday, for weekly rules.
    dayOfWeek: { type: Number, min: 0, max: 6, default: null },
    monthOfYear: { type: Number, min: 1, max: 12, default: null },

    startDate: { type: String, required: true }, // "YYYY-MM-DD"
    endDate: { type: String, default: null },

    nextRunAt: { type: Date, required: true, index: true },
    lastRunAt: { type: Date, default: null },
    lastRunDate: { type: String, default: null }, // local date of the last write

    // When false the rule only reminds; it never writes an Expense on its own.
    autoLog: { type: Boolean, default: true },

    isActive: { type: Boolean, default: true },
    runCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// The sweep's query: active rules that are due.
recurringRuleSchema.index({ isActive: 1, nextRunAt: 1 });
recurringRuleSchema.index({ user: 1, isActive: 1 });

export default model('RecurringRule', recurringRuleSchema);
