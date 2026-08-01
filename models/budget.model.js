import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * One budget document per user per month ("2026-08"), so changing August's
 * limit never rewrites July's reality. The daily allowance the home ring uses
 * is derived, not stored: overallLimitMinor / days-in-month (the design's
 * ৳18,000 month reads as ৳580 a day).
 *
 * Per-category limits are embedded rather than a separate collection — they're
 * always read with the parent, capped at a handful of rows, and edited as one
 * form.
 */
const categoryLimitSchema = new Schema(
  {
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    limitMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const budgetSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    month: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'month must be YYYY-MM'],
    },

    overallLimitMinor: { type: Number, required: true, min: 0 },
    categoryLimits: { type: [categoryLimitSchema], default: [] },

    currency: { type: String, required: true, uppercase: true },

    // When true, next month is created from this one automatically rather than
    // leaving the user budget-less on the 1st.
    rollForward: { type: Boolean, default: true },

    // Set once the user edits a month the system generated, so roll-forward
    // stops overwriting an intentional number.
    isUserEdited: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

budgetSchema.index({ user: 1, month: 1 }, { unique: true });

export default model('Budget', budgetSchema);
