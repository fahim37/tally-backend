import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import requireAuth from '../middlewares/auth.js';
import {
  google,
  login,
  logout,
  me,
  refresh,
  register,
  updateMe,
} from '../controllers/auth.controller.js';

const router = Router();

/**
 * The app-wide limiter in app.js is 120/min, which is a ceiling on traffic
 * rather than a defence against guessing a password. These are the endpoints
 * where an attempt is cheap for the attacker and expensive for us.
 */
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Successful sign-ins should not count toward the budget — someone logging
  // in on five devices is not an attack, and locking them out is worse than
  // the thing being prevented.
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many attempts. Wait a few minutes and try again.',
  },
});

router.post('/register', credentialLimiter, register);
router.post('/login', credentialLimiter, login);
router.post('/google', credentialLimiter, google);

// Rotation is already single-use, so a stolen refresh token buys one call and
// then burns the chain. It gets the blanket limiter, not this one.
router.post('/refresh', refresh);
router.post('/logout', logout);

router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateMe);

export default router;
