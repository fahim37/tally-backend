import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export const EXPENSE_SOURCES = ['tap', 'manual', 'parsed', 'scanned', 'recurring'];

/**
 * One logged expense.
 *
 * Quantity model — the design shows "Cigarette · ×7  ৳112" as ONE history row,
 * and the long-press sheet edits a "Quantity today" stepper. So a tap does not
 * append a document per tap: it upserts today's row for that tile and bumps
 * `quantity`. That makes the tally marks, the history row and the stepper the
 * same record, and undo is a decrement rather than a hunt for the last insert.
 *
 *   - tap        → upserted per (user, tile, localDate); quantity grows
 *   - manual/parsed/scanned/recurring → discrete rows, quantity usually 1
 *
 * Money — `unitAmountMinor` is the per-unit price at the moment of logging
 * (never re-read from the tile, so repricing is not retroactive) and
 * `totalAmountMinor` is the persisted product, so sums are a plain `$sum` and
 * never a `$multiply` across the collection.
 */
const expenseSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Null for anything not logged from the pad (typed, scanned, recurring).
    tile: { type: Schema.Types.ObjectId, ref: 'Tile', default: null },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },

    // Denormalized label so history rows and CSV export don't need the tile,
    // and so a deleted tile doesn't erase what the row said.
    name: { type: String, required: true, trim: true, maxlength: 80 },
    note: { type: String, trim: true, maxlength: 280 },
    merchant: { type: String, trim: true, maxlength: 80 },

    unitAmountMinor: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, default: 1, min: 0 },
    totalAmountMinor: { type: Number, required: true, min: 0, index: true },

    // Currency at time of logging, so a later switch doesn't reinterpret old
    // amounts as a different unit.
    currency: { type: String, required: true, uppercase: true },

    // The instant it happened, and the user-local day it belongs to.
    // Every rollup groups on `localDate` — see utils/date.js for why.
    occurredAt: { type: Date, required: true, default: Date.now },
    localDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'localDate must be YYYY-MM-DD'],
    },
    localMonth: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'localMonth must be YYYY-MM'],
    },

    source: { type: String, enum: EXPENSE_SOURCES, default: 'manual', required: true },

    // Provenance for the AI paths — lets the UI show "edit what we read" and
    // lets us measure parse quality without re-running the model.
    origin: {
      receipt: { type: Schema.Types.ObjectId, ref: 'Receipt', default: null },
      recurringRule: { type: Schema.Types.ObjectId, ref: 'RecurringRule', default: null },
      rawText: { type: String, default: null, maxlength: 500 },
      // 'keyword' when the lookup table classified it, 'ai' when Gemini split
      // the text, 'tile' when it came from the pad, 'user' when overridden.
      categorySource: {
        type: String,
        enum: ['tile', 'keyword', 'ai', 'user', 'fallback'],
        default: 'tile',
      },
      confidence: { type: Number, min: 0, max: 1, default: null },
    },

    // Offline idempotency. The PWA queues taps in IndexedDB and replays them on
    // reconnect; a retried request carrying the same clientId must not create a
    // second row. Unique per user, sparse so server-created rows can omit it.
    clientId: { type: String, default: null },

    // Soft delete drives the Undo affordance and the swipe-to-delete row;
    // every read filters on `deletedAt: null`.
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ── Indexes ────────────────────────────────────────────────────────────────
// History (grouped by day, newest first) and every day/month rollup.
expenseSchema.index({ user: 1, deletedAt: 1, localDate: -1, occurredAt: -1 });
// Category breakdown and per-category budget progress within a month.
expenseSchema.index({ user: 1, deletedAt: 1, localMonth: 1, category: 1 });
// Tap upsert target: today's row for this tile.
expenseSchema.index({ user: 1, tile: 1, localDate: 1, deletedAt: 1 });
// Offline replay dedupe.
//
// Partial, NOT sparse. A sparse index only skips documents where the field is
// *absent*, and `clientId` defaults to null — so every server-created row
// would carry the value null and the second one would collide. Filtering on
// `$type: 'string'` indexes only rows that actually carry a client id.
expenseSchema.index(
  { user: 1, clientId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientId: { $type: 'string' } },
  }
);
// Free-text search over the History search field.
expenseSchema.index({ user: 1, name: 'text', note: 'text', merchant: 'text' });

// Keep the persisted product honest no matter which path wrote the document.
expenseSchema.pre('validate', function computeTotal(next) {
  if (this.isModified('unitAmountMinor') || this.isModified('quantity') || this.isNew) {
    this.totalAmountMinor = Math.round(this.unitAmountMinor * this.quantity);
  }
  next();
});

expenseSchema.virtual('isDeleted').get(function isDeleted() {
  return this.deletedAt !== null;
});

/** Default scope for every read path. */
expenseSchema.query.active = function active() {
  return this.where({ deletedAt: null });
};

export default model('Expense', expenseSchema);
