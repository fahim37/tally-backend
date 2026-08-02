import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';

import env from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import accountStateRoutes from './routes/accountState.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import notFound from './middlewares/notFound.js';
import globalErrorHandler from './middlewares/globalErrorHandler.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (!env.isProduction) app.use(morgan('dev'));

// Blanket ceiling on traffic. The credential endpoints carry their own, much
// tighter limiter in routes/auth.routes.js — brute-forcing a password needs
// something stricter than this, and so will the AI routes when they land.
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, slow down a moment' },
  })
);

app.get('/', (req, res) => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Tally API is running',
    data: { version: '0.1.0', environment: env.NODE_ENV },
  });
});

app.get('/health', (req, res) => {
  res.status(StatusCodes.OK).json({ success: true, message: 'ok', data: null });
});

// ── Routes ─────────────────────────────────────────────────────────────────
// Feature routes.
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/account-state', accountStateRoutes);
app.use('/api/v1/uploads', uploadRoutes);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
