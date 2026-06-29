import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema, ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

export interface ValidationErrorDetail {
  path: string;
  message: string;
}

export class ValidationError extends AppError {
  public readonly details: ValidationErrorDetail[];

  constructor(details: ValidationErrorDetail[]) {
    super('Validation failed', 400);
    this.details = details;
  }
}

function formatZodIssues(error: ZodError): ValidationErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export { formatZodIssues };

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(new ValidationError(formatZodIssues(result.error)));
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(new ValidationError(formatZodIssues(result.error)));
      return;
    }

    req.query = result.data as Record<string, string | string[] | undefined>;
    next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      next(new ValidationError(formatZodIssues(result.error)));
      return;
    }

    req.params = result.data as Record<string, string>;
    next();
  };
}

export function validateHeader<T>(schema: ZodSchema<T>, headerName: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const headerValue = req.headers[headerName];
    const value =
      typeof headerValue === 'string'
        ? headerValue
        : Array.isArray(headerValue)
          ? headerValue[0]
          : undefined;

    const result = schema.safeParse({ refreshToken: value });

    if (!result.success) {
      next(new ValidationError(formatZodIssues(result.error)));
      return;
    }

    next();
  };
}
