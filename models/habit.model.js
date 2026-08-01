import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * A habit is a tile the user wants to see priced at day / month / year scale,
 * plus the "what if" projection and a streak.
 *
 * Tone rule from the brief: factual only. Nothing in this model encodes
 * judgement — there is no "bad habit" flag, no health metadata, no warning
 * copy. `targetDailyCount` is a number the user chose, and the streak counts
 * days at or under it. That's the whole vocabulary.
 */
const habitSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tile: { type: Schema.Types.ObjectId, ref: 'Tile', required: true },

    // Snapshot of the tile's label so the card survives a tile rename/delete.
    name: { type: String, required: true, trim: true, maxlength: 32 },

    // Per-unit cost used for the day/month/year projection. Defaults to the
    // tile's amount but can be pinned so the maths doesn't jump when a tile is
    // repriced mid-month.
    unitAmountMinor: { type: Number, required: true, min: 0 },

    // Observed average, recomputed from the last `baselineWindowDays` of
    // history. Stored so the card renders without an aggregation, and so the
    // "what if" baseline is stable between recomputes.
    baselineDailyCount: { type: Number, default: 0, min: 0 },
    baselineWindowDays: { type: Number, default: 30, min: 1 },
    baselineComputedAt: { type: Date, default: null },

    // The user's own target. Null means "tracking only, no target" — the card
    // still shows costs, just no streak.
    targetDailyCount: { type: Number, default: null, min: 0 },

    // Last position of the what-if stepper, so the screen reopens where it was.
    whatIfDailyCount: { type: Number, default: null, min: 0 },

    streak: {
      current: { type: Number, default: 0, min: 0 },
      longest: { type: Number, default: 0, min: 0 },
      // Last local date folded into the streak, so a recompute is incremental
      // and re-running it the same day is a no-op.
      lastEvaluatedDate: { type: String, default: null },
    },

    sortIndex: { type: Number, default: 0 },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

habitSchema.index({ user: 1, tile: 1 }, { unique: true });
habitSchema.index({ user: 1, isArchived: 1, sortIndex: 1 });

// Projections — plain arithmetic on integers, no rates or assumptions beyond
// the stated count. 365 rather than 365.25: the card says "a year" about a
// repeating daily purchase, and a whole number is what the user can check.
habitSchema.virtual('dailyCostMinor').get(function dailyCostMinor() {
  return Math.round(this.unitAmountMinor * this.baselineDailyCount);
});
habitSchema.virtual('monthlyCostMinor').get(function monthlyCostMinor() {
  return Math.round(this.unitAmountMinor * this.baselineDailyCount * 30);
});
habitSchema.virtual('yearlyCostMinor').get(function yearlyCostMinor() {
  return Math.round(this.unitAmountMinor * this.baselineDailyCount * 365);
});

/** Yearly saving if the daily count moved from baseline to `count`. */
habitSchema.methods.projectedYearlySavingMinor = function projectedYearlySaving(count) {
  const reduction = Math.max(0, this.baselineDailyCount - count);
  return Math.round(this.unitAmountMinor * reduction * 365);
};

export default model('Habit', habitSchema);
