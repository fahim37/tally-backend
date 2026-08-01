// Loads and validates environment. Imported first by every other module that
// needs config, so `dotenv` runs before any consumer reads `process.env`.
// (ES module imports are hoisted — calling dotenv.config() inside server.js
// would run *after* app.js and its transitive config had already been evaluated.)
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Auth. Two separate secrets so a leaked access token can't mint refreshes.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Google Sign-In: we verify the ID token the client obtains, so only the
  // client ID is needed here (no secret, no redirect dance).
  GOOGLE_CLIENT_ID: z.string().optional(),

  // Gemini — language parsing, receipts, summaries, Q&A.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_TEXT_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_VISION_MODEL: z.string().default('gemini-2.5-flash'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Comma-separated list of allowed browser origins.
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Defaults applied to every new account; the user can change them later.
  DEFAULT_CURRENCY: z.string().default('BDT'),
  DEFAULT_TIMEZONE: z.string().default('Asia/Dhaka'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

export default env;
