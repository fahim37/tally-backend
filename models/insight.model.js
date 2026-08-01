import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export const INSIGHT_KINDS = ['weekly_summary', 'forecast', 'anomaly', 'qa'];

/**
 * Cached AI output. The brief is explicit that summaries must not regenerate
 * on every page load, so reads go through this collection and only miss when
 * the underlying numbers actually moved.
 *
 * Two keys do that work together:
 *   `periodKey` — the bucket the insight describes ("2026-W31", "2026-08").
 *   `inputHash` — a digest of the figures the prompt was built from. A cached
 *                 row whose hash still matches today's figures is served as-is,
 *                 however old it is. Log one more expense into that week and
 *                 the hash changes, which is the only thing that triggers a
 *                 regenerate. Time alone never does.
 *
 * Q&A rows use the normalized question as `periodKey`, so asking the same
 * thing twice in a session is one call.
 */
const insightSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    kind: { type: String, enum: INSIGHT_KINDS, required: true },
    periodKey: { type: String, required: true },
    inputHash: { type: String, required: true },

    // Structured payload — the client renders these into the design's
    // sentence blocks rather than receiving prose HTML.
    content: {
      headline: { type: String, default: null },
      sentences: { type: [String], default: [] },
      // Free-form supporting figures the card renders (deltas, category names,
      // forecast totals). Shape varies by `kind`, so it stays Mixed.
      data: { type: Schema.Types.Mixed, default: {} },
    },

    // Only meaningful for kind 'qa'.
    question: { type: String, default: null, maxlength: 300 },

    ai: {
      model: { type: String, default: null },
      promptTokens: { type: Number, default: null },
      responseTokens: { type: Number, default: null },
      latencyMs: { type: Number, default: null },
    },

    // Cheap quality signal from the design's "That's right / Not unusual"
    // buttons on the anomaly card.
    feedback: { type: String, enum: ['helpful', 'not_helpful', null], default: null },

    generatedAt: { type: Date, default: Date.now },

    // Backstop only — the hash is the real invalidator. TTL sweeps rows the
    // user will never ask for again so the collection doesn't grow forever.
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// The cache lookup: "do I already have this insight for this data?"
insightSchema.index({ user: 1, kind: 1, periodKey: 1, inputHash: 1 }, { unique: true });
insightSchema.index({ user: 1, kind: 1, generatedAt: -1 });
// MongoDB TTL monitor removes documents once expiresAt passes; null never expires.
insightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model('Insight', insightSchema);
