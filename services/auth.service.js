import { StatusCodes } from 'http-status-codes';
import { OAuth2Client } from 'google-auth-library';
import env from '../config/env.js';
import { User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import { isValidTimezone } from '../utils/date.js';
import { bootstrapAccount } from './bootstrap.service.js';
import {
  consumeRefreshToken,
  issueRefreshToken,
  issueSession,
  revokeChain,
  revokeRefreshToken,
  signAccessToken,
} from './token.service.js';

/**
 * The account lifecycle. Everything here returns `{ user, accessToken,
 * refreshToken }` so the controller is a thin translation to the response
 * envelope and the client has one shape to parse.
 */

/**
 * Deliberately identical for "no such account" and "wrong password". Telling
 * the two apart turns the login form into an account-enumeration oracle —
 * anyone can discover whether an email has a Tally account.
 */
const CREDENTIALS_REJECTED = 'That email and password do not match an account';

export const register = async ({ email, password }, context) => {
  const user = await User.create({ email, passwordHash: password });

  // A new account gets its categories and tiles so the Tap Pad works on first
  // open. It deliberately does NOT get a budget — the user sets that in
  // onboarding, and inventing one would be fabricated data.
  await bootstrapAccount(user);

  return { user, ...(await issueSession(user, context)) };
};

export const login = async ({ email, password }, context) => {
  const user = await User.findByEmail(email, { withPassword: true });

  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, CREDENTIALS_REJECTED);
  }

  // An account created through Google has no password to compare against.
  // Saying so is not an enumeration leak, because reaching this branch already
  // required knowing the address — and without it the user is stuck guessing a
  // password that does not exist.
  if (!user.passwordHash) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      'That account was created with Google. Continue with Google instead.'
    );
  }

  if (!(await user.comparePassword(password))) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, CREDENTIALS_REJECTED);
  }

  user.lastActiveAt = new Date();
  await user.save();

  return { user, ...(await issueSession(user, context)) };
};

/**
 * Rotation: the presented token is consumed and a successor issued in its
 * place. `consumeRefreshToken` owns the replay rule.
 */
export const refresh = async ({ refreshToken }, context) => {
  const record = await consumeRefreshToken(refreshToken);

  const user = await User.findOne({ _id: record.user, deletedAt: null });
  if (!user) {
    await revokeChain(record.user);
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Session expired, please sign in again');
  }

  const next = await issueRefreshToken(user, context, { replaces: record });

  return { user, accessToken: signAccessToken(user), refreshToken: next };
};

/** Never fails. A sign-out that can error is a sign-out users cannot trust. */
export const logout = async ({ refreshToken }) => {
  await revokeRefreshToken(refreshToken);
};

// ── Google ─────────────────────────────────────────────────────────────────

// Only the client ID is needed: the browser obtains the ID token and the API
// verifies its signature against Google's keys, so there is no client secret
// and no redirect callback to keep in sync.
const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

export const loginWithGoogle = async ({ idToken }, context) => {
  if (!googleClient) {
    throw new ApiError(
      StatusCodes.SERVICE_UNAVAILABLE,
      "Google sign-in isn't configured on this server"
    );
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'That Google sign-in could not be verified');
  }

  if (!payload?.email) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'That Google account has no email address');
  }

  // Linking on an unverified address would let anyone who can set an arbitrary
  // Google profile email take over an existing Tally account.
  if (!payload.email_verified) {
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      'That Google account has an unverified email address'
    );
  }

  let user = await User.findOne({ googleId: payload.sub, deletedAt: null });
  let isNew = false;

  if (!user) {
    user = await User.findByEmail(payload.email);

    if (user) {
      // Same person, already has an email account — link rather than fork.
      user.googleId = payload.sub;
      if (!user.authProviders.includes('google')) user.authProviders.push('google');
      if (!user.displayName && payload.name) user.displayName = payload.name;
      if (!user.avatarUrl && payload.picture) user.avatarUrl = payload.picture;
    } else {
      user = new User({
        email: payload.email,
        googleId: payload.sub,
        authProviders: ['google'],
        displayName: payload.name,
        avatarUrl: payload.picture,
        emailVerifiedAt: new Date(),
      });
      isNew = true;
    }
  }

  user.lastActiveAt = new Date();
  await user.save();

  if (isNew) await bootstrapAccount(user);

  return { user, ...(await issueSession(user, context)) };
};

// ── Account ────────────────────────────────────────────────────────────────

/**
 * Built from an explicit allow-list rather than by spreading the body — a
 * spread here is how `stats`, `tokenVersion`, `email` or `googleId` become
 * client-writable and the whole auth model comes apart.
 */
export const updateAccount = async (user, patch) => {
  if (patch.displayName !== undefined) user.displayName = patch.displayName;
  if (patch.currency !== undefined) user.currency = patch.currency;
  if (patch.appearance !== undefined) user.appearance = patch.appearance;

  if (patch.timezone !== undefined) {
    if (!isValidTimezone(patch.timezone)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'That is not a recognised timezone');
    }
    user.timezone = patch.timezone;
  }

  if (patch.onboarding) {
    const { completed, step } = patch.onboarding;
    if (step !== undefined) user.onboarding.step = step;
    if (completed !== undefined) {
      user.onboarding.completed = completed;
      // Stamped once, on the transition — re-finishing onboarding later must
      // not rewrite when the account actually got going.
      if (completed && !user.onboarding.completedAt) {
        user.onboarding.completedAt = new Date();
      }
    }
  }

  user.lastActiveAt = new Date();
  await user.save();
  return user;
};
