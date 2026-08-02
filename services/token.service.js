import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import env from '../config/env.js';
import { RefreshToken } from '../models/index.js';
import ApiError from '../utils/ApiError.js';

/**
 * Token minting, verification and rotation.
 *
 * Two secrets, never one: a leaked access token must not be able to mint
 * refreshes. The access token is a short-lived bearer credential the client
 * sends on every call; the refresh token is a long-lived opaque string that
 * only ever appears in a request body, is stored as a SHA-256 digest, and is
 * single-use.
 */

const ACCESS_SUBJECT = 'tally.access';

/**
 * The access token carries `tokenVersion` so a password change or a "sign out
 * everywhere" can invalidate every outstanding token by bumping one counter on
 * the user, without a database lookup per request to check a revocation list.
 */
export const signAccessToken = (user) =>
  jwt.sign(
    { sub: String(user._id), tokenVersion: user.tokenVersion ?? 0, typ: ACCESS_SUBJECT },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );

export const verifyAccessToken = (token) => {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  // A refresh token signed with the other secret can never land here, but a
  // token of some future type signed with this one could — so the type is
  // checked rather than assumed.
  if (payload.typ !== ACCESS_SUBJECT) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid token');
  }
  return payload;
};

/**
 * The refresh token is opaque randomness rather than a JWT. There is nothing
 * to read from it, and its validity is decided entirely by the row we store —
 * which is what makes single-use rotation and revocation possible at all.
 * The JWT wrapper exists only to carry an expiry the client can inspect.
 */
const RAW_BYTES = 48;

const expiryFromNow = () => {
  const decoded = jwt.decode(
    jwt.sign({ t: 1 }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN })
  );
  return new Date(decoded.exp * 1000);
};

/**
 * Issues a refresh token and records its digest. `context` is the request's
 * user-agent and IP, kept so a user can later be shown where their sessions
 * are — and so a replay can be traced.
 */
export const issueRefreshToken = async (user, context = {}, { replaces = null } = {}) => {
  const raw = crypto.randomBytes(RAW_BYTES).toString('hex');
  const tokenHash = RefreshToken.hash(raw);

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    expiresAt: expiryFromNow(),
    userAgent: context.userAgent ? String(context.userAgent).slice(0, 300) : null,
    ip: context.ip ?? null,
  });

  if (replaces) {
    await RefreshToken.updateOne(
      { _id: replaces._id },
      { $set: { usedAt: new Date(), replacedBy: tokenHash } }
    );
  }

  return raw;
};

/** Revokes every live token for a user — the response to a detected replay. */
export const revokeChain = async (userId) => {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

export const revokeRefreshToken = async (raw) => {
  if (!raw) return;
  await RefreshToken.updateOne(
    { tokenHash: RefreshToken.hash(raw), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

/**
 * Resolves a presented refresh token to its row, applying the replay rule.
 *
 * A token that has already been used is not merely expired — it means two
 * parties hold the same token, so the legitimate client and the attacker are
 * indistinguishable from here. The only safe response is to revoke everything
 * and make both sign in again.
 */
export const consumeRefreshToken = async (raw) => {
  if (!raw || typeof raw !== 'string') {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Session expired, please sign in again');
  }

  const record = await RefreshToken.findOne({ tokenHash: RefreshToken.hash(raw) });

  if (!record) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Session expired, please sign in again');
  }

  if (record.usedAt) {
    await revokeChain(record.user);
    throw new ApiError(
      StatusCodes.UNAUTHORIZED,
      'That session was already refreshed elsewhere. Please sign in again.'
    );
  }

  if (record.revokedAt || record.expiresAt <= new Date()) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Session expired, please sign in again');
  }

  return record;
};

/** The pair every auth response returns. */
export const issueSession = async (user, context) => ({
  accessToken: signAccessToken(user),
  refreshToken: await issueRefreshToken(user, context),
});
