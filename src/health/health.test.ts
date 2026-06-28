import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';

describe('GET /health', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    // nothing to clean up yet
  });

  it('returns 200 ok', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });
});
