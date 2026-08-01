import mongoose from 'mongoose';
import crypto from 'node:crypto';

const { Schema, model } = mongoose;

/**
 * Refresh tokens, stored as SHA-256 digests. The raw token only ever exists in
 * the response body and the client's storage — a database dump does not hand
 * anyone a working session.
 *
 * Rotation: each refresh issues a new token and marks the old one used,
 * pointing at its replacement. If a *used* token is presented again, that's a
 * replay of a stolen token, and the whole chain gets revoked.
 */
const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    tokenHash: { type: String, required: true, unique: true },

    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null }, // hash of the successor

    userAgent: { type: String, default: null, maxlength: 300 },
    ip: { type: String, default: null },
  },
  { timestamps: true }
);

// Expired rows clear themselves out.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1, revokedAt: 1 });

refreshTokenSchema.statics.hash = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

refreshTokenSchema.virtual('isActive').get(function isActive() {
  return !this.revokedAt && !this.usedAt && this.expiresAt > new Date();
});

export default model('RefreshToken', refreshTokenSchema);
