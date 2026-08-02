import { StatusCodes } from 'http-status-codes';
import catchAsync from '../utils/catchAsync.js';
import sendResponse from '../utils/sendResponse.js';
import * as authService from '../services/auth.service.js';
import {
  googleSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  updateAccountSchema,
} from '../validators/auth.validator.js';

/**
 * Thin translation between HTTP and the auth service. Validation throws a
 * ZodError and token/credential problems throw ApiError; both are turned into
 * the response envelope by `globalErrorHandler`, so there is no try/catch here.
 */

/** User-agent and IP are recorded against each refresh token. */
const contextOf = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

/** Mongoose `toJSON` strips `passwordHash` and `tokenVersion` — see the model. */
const present = ({ user, accessToken, refreshToken }) => ({
  user: user.toJSON(),
  accessToken,
  refreshToken,
});

export const register = catchAsync(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const result = await authService.register(body, contextOf(req));

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    message: 'Account created',
    data: present(result),
  });
});

export const login = catchAsync(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const result = await authService.login(body, contextOf(req));

  sendResponse(res, { message: 'Signed in', data: present(result) });
});

export const refresh = catchAsync(async (req, res) => {
  const body = refreshSchema.parse(req.body);
  const { accessToken, refreshToken } = await authService.refresh(body, contextOf(req));

  // Deliberately no `user` here: this runs on a timer in the background and
  // the client already has the profile. Returning it would invite screens to
  // treat a token refresh as a profile sync.
  sendResponse(res, { message: 'Session refreshed', data: { accessToken, refreshToken } });
});

export const logout = catchAsync(async (req, res) => {
  const body = logoutSchema.parse(req.body ?? {});
  await authService.logout(body);

  sendResponse(res, { message: 'Signed out', data: null });
});

export const google = catchAsync(async (req, res) => {
  const body = googleSchema.parse(req.body);
  const result = await authService.loginWithGoogle(body, contextOf(req));

  sendResponse(res, { message: 'Signed in with Google', data: present(result) });
});

export const me = catchAsync(async (req, res) => {
  sendResponse(res, { message: 'Account', data: { user: req.user.toJSON() } });
});

export const updateMe = catchAsync(async (req, res) => {
  const patch = updateAccountSchema.parse(req.body);
  const user = await authService.updateAccount(req.user, patch);

  sendResponse(res, { message: 'Account updated', data: { user: user.toJSON() } });
});
