import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { DEFAULT_CURRENCY } from '../utils/money.js';
import { DEFAULT_TIMEZONE } from '../utils/date.js';

const { Schema, model } = mongoose;

/**
 * Signup is deliberately two fields: email + password. Nothing else is
 * required to create an account — no name, no confirm field, no verification
 * gate. `displayName` is derived from the email until the user sets one, and
 * currency/timezone/budget all carry defaults that onboarding can revise.
 */
const userSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address'],
    },

    // Absent for Google-only accounts. `select: false` keeps the hash out of
    // every ordinary query — the login path opts in explicitly.
    passwordHash: {
      type: String,
      select: false,
      minlength: 8,
    },

    googleId: {
      type: String,
      // sparse: Google-less accounts all have `undefined` here and must not
      // collide on the unique index.
      unique: true,
      sparse: true,
      index: true,
    },

    authProviders: {
      type: [{ type: String, enum: ['email', 'google'] }],
      default: ['email'],
    },

    displayName: { type: String, trim: true, maxlength: 60 },
    avatarUrl: { type: String, trim: true },

    // Email delivery isn't wired up, so this is recorded but never blocks
    // access — signup stays one step.
    emailVerifiedAt: { type: Date, default: null },

    currency: {
      type: String,
      default: DEFAULT_CURRENCY,
      uppercase: true,
      trim: true,
    },

    // Drives `localDate` on every expense; changing it does not rewrite
    // history, it only affects subsequent writes.
    timezone: {
      type: String,
      default: DEFAULT_TIMEZONE,
      trim: true,
    },

    appearance: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },

    onboarding: {
      completed: { type: Boolean, default: false },
      // 1 currency · 2 budget · 3 pick habits, matching screens 14–16.
      step: { type: Number, default: 1, min: 1, max: 3 },
      completedAt: { type: Date, default: null },
    },

    // Denormalized so Profile and the streak badge are a single document read
    // instead of a full-history aggregation on every open. Recomputed by the
    // expense service on each log.
    stats: {
      totalTaps: { type: Number, default: 0, min: 0 },
      currentStreak: { type: Number, default: 0, min: 0 },
      longestStreak: { type: Number, default: 0, min: 0 },
      lastLoggedDate: { type: String, default: null }, // "YYYY-MM-DD"
      firstLoggedDate: { type: String, default: null },
    },

    // Bumping this invalidates every outstanding refresh token at once
    // (sign out everywhere, password change).
    tokenVersion: { type: Number, default: 0 },

    lastActiveAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.tokenVersion;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

userSchema.virtual('name').get(function name() {
  return this.displayName || this.email?.split('@')[0] || 'there';
});

userSchema.virtual('hasPassword').get(function hasPassword() {
  return Boolean(this.passwordHash);
});

// Hash only when the plaintext was actually set on this save.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) return next();
  // Already a bcrypt digest (e.g. re-saving a loaded doc) — don't double-hash.
  if (/^\$2[aby]\$\d{2}\$/.test(this.passwordHash)) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.findByEmail = function findByEmail(email, { withPassword = false } = {}) {
  const query = this.findOne({ email: String(email).toLowerCase().trim(), deletedAt: null });
  return withPassword ? query.select('+passwordHash') : query;
};

export default model('User', userSchema);
