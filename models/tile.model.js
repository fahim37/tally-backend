import mongoose from 'mongoose';
import { DEFAULT_ICON_KEY, ICON_KEYS } from '../constants/icons.js';

const { Schema, model } = mongoose;

/**
 * A Tap Pad tile. One tap creates or increments today's Expense for this tile,
 * so the tile owns the *default* amount while each Expense keeps the amount it
 * was actually logged at — repricing a tile never rewrites history.
 */
const tileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    name: { type: String, required: true, trim: true, maxlength: 32 },
    iconKey: { type: String, enum: ICON_KEYS, default: DEFAULT_ICON_KEY },

    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },

    // Minor units. What a single tap logs.
    defaultAmountMinor: { type: Number, required: true, min: 0 },

    // The four choices in the long-press sheet.
    presetAmountsMinor: {
      type: [Number],
      default: [],
      validate: {
        validator: (v) => v.every((n) => Number.isInteger(n) && n >= 0),
        message: 'Preset amounts must be non-negative integers in minor units',
      },
    },

    // "Tiles reorder by frequency of use": the pad sorts on `usageCount` desc
    // by default. `sortIndex` is the manual override, used when the user drags
    // tiles into their own order; `isPinned` keeps a tile in place regardless.
    usageCount: { type: Number, default: 0, min: 0, index: true },
    lastUsedAt: { type: Date, default: null },
    sortIndex: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
    manualOrder: { type: Boolean, default: false },

    // Seeded tiles carry their seed key so onboarding and the seeder can match
    // them idempotently; user-created tiles leave it null.
    seedKey: { type: String, default: null },
    isCustom: { type: Boolean, default: false },

    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

tileSchema.index({ user: 1, isArchived: 1, usageCount: -1 });
// Partial, not sparse — `seedKey` defaults to null on custom tiles, and a
// sparse unique index would treat those nulls as colliding values, so a user
// could only ever create one custom tile. See the same note on Expense.clientId.
tileSchema.index(
  { user: 1, seedKey: 1 },
  { unique: true, partialFilterExpression: { seedKey: { $type: 'string' } } }
);

/** Registers a tap for ordering purposes. */
tileSchema.methods.registerUse = function registerUse(count = 1) {
  this.usageCount += count;
  this.lastUsedAt = new Date();
  return this.save();
};

export default model('Tile', tileSchema);
