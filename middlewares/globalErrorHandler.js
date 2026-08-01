import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * Translates the error types this API actually throws into the `{ success,
 * message, errors }` envelope. Anything unrecognised is reported as a generic
 * 500 with the detail kept server-side — an unexpected error message can carry
 * connection strings or query fragments, so it is logged, not returned.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  let message = err.message || 'Something went wrong';
  let errors;

  if (err instanceof ZodError) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Validation failed';
    errors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    statusCode = StatusCodes.CONFLICT;
    const field = Object.keys(err.keyValue ?? {})[0];
    // The duplicate that matters to a user is an email already signed up.
    message =
      field === 'email'
        ? 'An account with that email already exists'
        : `That ${field ?? 'value'} is already in use`;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = 'Session expired, please sign in again';
  } else if (err.name === 'MulterError') {
    statusCode = StatusCodes.BAD_REQUEST;
    message =
      err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5MB or smaller' : err.message;
  } else if (err.http_code) {
    // Cloudinary surfaces its own status this way.
    statusCode = err.http_code;
  }

  const isUnexpected = statusCode >= 500 && !err.isOperational;

  if (isUnexpected) {
    console.error('Unhandled error:', {
      method: req.method,
      url: req.originalUrl,
      error: err,
    });
    if (env.isProduction) message = 'Something went wrong';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(!env.isProduction && { stack: err.stack }),
  });
};

export default globalErrorHandler;
