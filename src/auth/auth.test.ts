import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { RegisterUserUseCase } from '../domains/user/application/register-user.js';
import { InMemoryUserRepository } from '../domains/user/infrastructure/user.repository.in-memory.js';

describe('POST /auth/register', () => {
  let app: Express;
  let userRepository: InMemoryUserRepository;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    const registerUserUseCase = new RegisterUserUseCase(userRepository);
    app = await createApp({ authDependencies: { registerUserUseCase } });
  });

  it('creates a new user and returns public profile', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        email: 'alice@example.com',
        displayName: 'Alice',
        password: 'Password123!',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      email: 'alice@example.com',
      displayName: 'Alice',
    });
    expect(response.body.id).toBeDefined();
    expect(response.body.passwordHash).toBeUndefined();
  });

  it('normalizes email to lowercase', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        email: 'BOB@EXAMPLE.COM',
        displayName: 'Bob',
        password: 'Password123!',
      })
      .expect(201);

    expect(response.body.email).toBe('bob@example.com');
  });

  it('returns 409 for duplicate email', async () => {
    await request(app).post('/auth/register').send({
      email: 'charlie@example.com',
      displayName: 'Charlie',
      password: 'Password123!',
    });

    const response = await request(app)
      .post('/auth/register')
      .send({
        email: 'charlie@example.com',
        displayName: 'Charlie2',
        password: 'Password123!',
      })
      .expect(409);

    expect(response.body.error.message).toBe('An account with this email already exists');
  });

  it('returns 400 for weak password', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        email: 'dave@example.com',
        displayName: 'Dave',
        password: 'weak',
      })
      .expect(400);

    expect(response.body.error.message).toBe('Validation failed');
  });

  it('returns 400 for missing fields', async () => {
    const response = await request(app).post('/auth/register').send({}).expect(400);

    expect(response.body.error.message).toBe('Email, displayName, and password are required');
  });
});
