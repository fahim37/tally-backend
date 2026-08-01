import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export const RECEIPT_STATUSES = ['uploaded', 'parsing', 'parsed', 'failed', 'confirmed'];

/**
 * A scanned receipt: the Cloudinary asset plus whatever Gemini read off it.
 *
 * Parsing is not trusted into the ledger. The scan produces `parsed.lineItems`
 * for the user to review and edit; only on confirm are Expenses created and
 * their ids recorded in `expenses`. That keeps a misread total out of the
 * dashboard and gives the "edit what we read" step somewhere to live.
 */
const lineItemSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    amountMinor: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 1, min: 0 },
    categorySlug: { type: String, default: null },
    confidence: { type: Number, min: 0, max: 1, default: null },
    // Cleared by the user in review, or kept when they accept the read as-is.
    isAccepted: { type: Boolean, default: true },
  },
  { _id: true }
);

const receiptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Cloudinary — publicId is what the existing delete endpoint takes.
    publicId: { type: String, required: true },
    secureUrl: { type: String, required: true },
    width: Number,
    height: Number,
    bytes: Number,
    format: String,

    status: { type: String, enum: RECEIPT_STATUSES, default: 'uploaded', index: true },

    parsed: {
      merchant: { type: String, trim: true, maxlength: 80, default: null },
      // What the model read as the printed total, kept separate from the sum
      // of line items so the two can be reconciled in review.
      totalMinor: { type: Number, default: null, min: 0 },
      currency: { type: String, default: null, uppercase: true },
      purchasedAt: { type: Date, default: null },
      lineItems: { type: [lineItemSchema], default: [] },
    },

    // Set when the line items don't sum to the printed total, so the review
    // screen can surface the gap instead of silently picking one.
    reconciliationDeltaMinor: { type: Number, default: null },

    ai: {
      model: { type: String, default: null },
      promptTokens: { type: Number, default: null },
      responseTokens: { type: Number, default: null },
      latencyMs: { type: Number, default: null },
      error: { type: String, default: null },
    },

    expenses: [{ type: Schema.Types.ObjectId, ref: 'Expense' }],
    confirmedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

receiptSchema.index({ user: 1, createdAt: -1 });

export default model('Receipt', receiptSchema);
