import mongoose from 'mongoose';
import { DEFAULT_ICON_KEY, ICON_KEYS } from '../constants/icons.js';

const { Schema, model } = mongoose;

/**
 * Categories are per-user (seeded from DEFAULT_CATEGORIES at signup) rather
 * than global, so a user can rename "Cigarettes", recolor it, or teach it a
 * new keyword without touching anyone else's data.
 *
 * `keywords` is the lookup table `matchCategory` runs against — this is what
 * keeps routine categorization off the AI path.
 */
const categorySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    slug: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },

    // Design token first (so the client can stay on its CSS variables), with a
    // hex fallback for chart fills, CSV and anything rendered outside the app.
    colorToken: { type: String, default: 'var(--line)' },
    colorHex: { type: String, default: '#E4E7EC' },

    iconKey: { type: String, enum: ICON_KEYS, default: DEFAULT_ICON_KEY },

    keywords: {
      type: [String],
      default: [],
      set: (values) =>
        [...new Set((values ?? []).map((v) => String(v).toLowerCase().trim()).filter(Boolean))],
    },

    // System categories can be renamed but not deleted — expenses reference
    // them and 'other' is the fallback target.
    isSystem: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    sortIndex: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// One slug per user; the same slug across users is expected.
categorySchema.index({ user: 1, slug: 1 }, { unique: true });
categorySchema.index({ user: 1, sortIndex: 1 });

export default model('Category', categorySchema);
