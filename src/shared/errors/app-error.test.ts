import { describe, expect, it } from 'vitest';
import { AppError, NotFoundError } from './app-error.js';

describe('AppError', () => {
  it('captures status code and operational flag', () => {
    const error = new AppError('Something went wrong', 418, true);

    expect(error.message).toBe('Something went wrong');
    expect(error.statusCode).toBe(418);
    expect(error.isOperational).toBe(true);
  });

  it('provides convenience subclasses', () => {
    const error = new NotFoundError('User not found');

    expect(error.statusCode).toBe(404);
  });
});
