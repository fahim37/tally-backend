import { z } from 'zod';

/**
 * Request shapes for the auth routes.
 *
 * `globalErrorHandler` already turns a ZodError into
 * `{ success, message, errors: [{ field, message }] }`, so these messages are
 * user-facing copy, not developer notes — they are what the sign-in form
 * renders under the field.
 */

const email = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "That doesn't look like an email address");

// Eight characters and nothing else. The User model's comment is explicit that
// signup is deliberately two frictionless fields; complexity rules push people
// toward reused passwords and a "forgot password" flow this app does not have.
const password = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Use at least 8 characters')
  .max(200, 'That password is too long');

export const registerSchema = z.object({ email, password });

// Login must not restate the signup rules: an account created before a rule
// changed still has to be able to sign in.
export const loginSchema = z.object({
  email,
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string({ required_error: 'refreshToken is required' }).min(1),
});

// Logout accepts a missing token: signing out of a session whose token was
// already dropped must still succeed.
export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const googleSchema = z.object({
  idToken: z.string({ required_error: 'idToken is required' }).min(1, 'idToken is required'),
});

export const updateAccountSchema = z
  .object({
    displayName: z.string().trim().max(60, 'Keep it under 60 characters').optional(),
    currency: z.string().trim().length(3, 'Use a 3-letter currency code').toUpperCase().optional(),
    timezone: z.string().trim().min(1).optional(),
    appearance: z.enum(['light', 'dark', 'system']).optional(),
    onboarding: z
      .object({
        completed: z.boolean().optional(),
        step: z.number().int().min(1).max(3).optional(),
      })
      .optional(),
  })
  // An empty PATCH is a client bug, and silently returning the unchanged user
  // hides it.
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  });
