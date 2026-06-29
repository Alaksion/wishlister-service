import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from './zod-validation.js';
import type { Request, Response } from 'express';

function createRequest(partial: Partial<Request> = {}): Request {
  return {
    ...partial,
  } as unknown as Request;
}

function createResponse(): Response {
  return {
    status: function (_code: number) {
      return this;
    },
    json: function (_body: unknown) {
      return this;
    },
  } as unknown as Response;
}

const testSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.coerce.number().int().min(0, 'Age must be non-negative'),
});

describe('validateBody', () => {
  it('calls next without error for valid body', () => {
    const req = createRequest({ body: { name: 'Alice', age: 30 } });
    const res = createResponse();
    const next = vi.fn();

    validateBody(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('calls next with ValidationError for invalid body', () => {
    const req = createRequest({ body: { name: '', age: -1 } });
    const res = createResponse();
    const next = vi.fn();

    validateBody(testSchema)(req, res, next);

    const error = next.mock.calls[0]![0];
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Validation failed');
    expect(error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.any(String), message: expect.any(String) }),
      ])
    );
  });
});

describe('validateQuery', () => {
  it('calls next without error for valid query', () => {
    const req = createRequest({ query: { name: 'Alice', age: '30' } });
    const res = createResponse();
    const next = vi.fn();

    validateQuery(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ name: 'Alice', age: 30 });
  });

  it('calls next with ValidationError for invalid query', () => {
    const req = createRequest({ query: { name: '', age: '-1' } });
    const res = createResponse();
    const next = vi.fn();

    validateQuery(testSchema)(req, res, next);

    const error = next.mock.calls[0]![0];
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Validation failed');
    expect(error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.any(String), message: expect.any(String) }),
      ])
    );
  });
});

describe('validateParams', () => {
  it('calls next without error for valid params', () => {
    const req = createRequest({ params: { name: 'Alice', age: '30' } });
    const res = createResponse();
    const next = vi.fn();

    validateParams(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.params).toEqual({ name: 'Alice', age: 30 });
  });

  it('calls next with ValidationError for invalid params', () => {
    const req = createRequest({ params: { name: '', age: '-1' } });
    const res = createResponse();
    const next = vi.fn();

    validateParams(testSchema)(req, res, next);

    const error = next.mock.calls[0]![0];
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Validation failed');
    expect(error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.any(String), message: expect.any(String) }),
      ])
    );
  });
});
