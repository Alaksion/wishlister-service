import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { ValidationError, formatZodIssues } from './zod-validation.js';
import { config } from '../config/config.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        details: formatZodIssues(err),
      },
    });
    return;
  }

  console.error('Unexpected error:', err);

  res.status(500).json({
    error: {
      message:
        config.NODE_ENV === 'production'
          ? 'Internal server error'
          : err instanceof Error
            ? err.message
            : 'Internal server error',
      ...(config.NODE_ENV !== 'production' && err instanceof Error && err.stack
        ? { stack: err.stack }
        : {}),
    },
  });
};
