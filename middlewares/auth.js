import { StatusCodes } from 'http-status-codes';
import { User } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import { verifyAccessToken } from '../services/token.service.js';

/**
 * Bearer guard. Puts the User document on `req.user` so downstream handlers
 * never re-read it.
 *
 * `jwt.verify` throws `JsonWebTokenError` / `TokenExpiredError`, which
 * `globalErrorHandler` already maps to a 401 with the right message — an
 * expired session and a forged token should not read the same to the client,
 * and that distinction is made there.
 */
const requireAuth = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Sign in to continue');
  }

  const payload = verifyAccessToken(token);

  const user = await User.findOne({ _id: payload.sub, deletedAt: null });
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Sign in to continue');
  }

  // The version in the token is a snapshot of the moment it was minted.
  // Bumping `user.tokenVersion` (password change, sign out everywhere)
  // invalidates every outstanding access token at once without a per-request
  // revocation-list lookup.
  if ((payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Session expired, please sign in again');
  }

  req.user = user;
  return next();
});

export default requireAuth;
