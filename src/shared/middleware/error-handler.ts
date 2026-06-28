import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import { config } from '../config/config.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
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
