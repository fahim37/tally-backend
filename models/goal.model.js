import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * A savings goal, optionally linked to a habit reduction — the design's
 * "8 cigarettes a day → a new phone by March".
 *
 * `savedAmountMinor` is accrued, not derived on the fly: each day the user
 * finishes at or under `linkedHabit.targetDailyCount`, the day's avoided spend
 * is added and the date recorded. Deriving it live would make the number jump
 * around as history was edited, and the screen presents it as money banked.
 */
const goalSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 80 },
    note: { type: String, trim: true, maxlength: 280 },

    targetAmountMinor: { type: Number, required: true, min: 0 },
    savedAmountMinor: { type: Number, default: 0, min: 0 },
    currency: { type: String, required: true, uppercase: true },

    linkedHabit: { type: Schema.Types.ObjectId, ref: 'Habit', default: null },
    // Units per day the user is committing to skip; the accrual rate is
    // reductionPerDay × habit.unitAmountMinor.
    reductionPerDay: { type: Number, default: null, min: 0 },

    startedAt: { type: Date, default: Date.now },
    targetDate: { type: Date, default: null },

    // Guards the accrual against double-counting a day on re-run.
    lastAccruedDate: { type: String, default: null },

    achievedAt: { type: Date, default: null },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

goalSchema.index({ user: 1, isArchived: 1, createdAt: -1 });

goalSchema.virtual('progressRatio').get(function progressRatio() {
  if (!this.targetAmountMinor) return 0;
  return Math.min(1, this.savedAmountMinor / this.targetAmountMinor);
});

goalSchema.virtual('remainingMinor').get(function remainingMinor() {
  return Math.max(0, this.targetAmountMinor - this.savedAmountMinor);
});

export default model('Goal', goalSchema);
