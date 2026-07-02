import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { RegisterUserUseCase } from '../../domains/user/application/register-user.js';
import { LoginUseCase } from '../../domains/user/application/login.js';
import { LogoutUseCase } from '../../domains/user/application/logout.js';
import { LogoutAllUseCase } from '../../domains/user/application/logout-all.js';
import { RefreshUseCase } from '../../domains/user/application/refresh.js';
import { InMemoryUserRepository } from '../../test/fakes/user.repository.in-memory.js';
import { InMemoryRefreshTokenRepository } from '../../test/fakes/refresh-token.repository.in-memory.js';
import { config } from '../../shared/config/config.js';

describe('Auth endpoints', () => {
  let app: Express;
  let userRepository: InMemoryUserRepository;
  let refreshTokenRepository: InMemoryRefreshTokenRepository;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    refreshTokenRepository = new InMemoryRefreshTokenRepository();
    const registerUserUseCase = new RegisterUserUseCase(userRepository);
    const loginUseCase = new LoginUseCase(userRepository, refreshTokenRepository);
    const logoutUseCase = new LogoutUseCase(refreshTokenRepository);
    const logoutAllUseCase = new LogoutAllUseCase(refreshTokenRepository);
    const refreshUseCase = new RefreshUseCase(refreshTokenRepository);
    app = await createApp({
      authDependencies: {
        registerUserUseCase,
        loginUseCase,
        logoutUseCase,
        logoutAllUseCase,
        refreshUseCase,
      },
    });
  });

  describe('POST /auth/register', () => {
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

      expect(response.body.error.message).toBe('Validation failed');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: expect.any(String), message: expect.any(String) }),
        ])
      );
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/auth/register').send({
        email: 'alice@example.com',
        displayName: 'Alice',
        password: 'Password123!',
      });
    });

    it('returns access and refresh tokens for valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();

      const payload = jwt.verify(response.body.accessToken, config.JWT_ACCESS_SECRET) as {
        sub: string;
        exp: number;
        iat: number;
      };
      expect(payload.sub).toBeDefined();
      expect(payload.exp - payload.iat).toBe(15 * 60);
    });

    it('returns 401 for unknown email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'unknown@example.com',
          password: 'Password123!',
        })
        .expect(401);

      expect(response.body.error.message).toBe('Invalid credentials');
    });

    it('returns 401 for wrong password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.error.message).toBe('Invalid credentials');
    });

    it('returns 400 for missing fields', async () => {
      const response = await request(app).post('/auth/login').send({}).expect(400);

      expect(response.body.error.message).toBe('Validation failed');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: expect.any(String), message: expect.any(String) }),
        ])
      );
    });

    it('persists a hash of the refresh token', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'Password123!',
        })
        .expect(200);

      const storedTokens = refreshTokenRepository['refreshTokens'];
      expect(storedTokens).toHaveLength(1);
      const storedToken = storedTokens[0]!;
      expect(storedToken.userId).toBeDefined();
      expect(storedToken.tokenHash).not.toBe(response.body.refreshToken);
      expect(storedToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('POST /auth/logout', () => {
    let refreshToken: string;

    beforeEach(async () => {
      await request(app).post('/auth/register').send({
        email: 'alice@example.com',
        displayName: 'Alice',
        password: 'Password123!',
      });

      const response = await request(app).post('/auth/login').send({
        email: 'alice@example.com',
        password: 'Password123!',
      });

      refreshToken = response.body.refreshToken;
    });

    it('returns 204 and revokes the refresh token', async () => {
      await request(app).post('/auth/logout').set('x-refresh-token', refreshToken).expect(204);

      const storedTokens = refreshTokenRepository['refreshTokens'];
      expect(storedTokens).toHaveLength(0);
    });

    it('returns 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('x-refresh-token', 'invalid-token')
        .expect(401);

      expect(response.body.error.message).toBe('Invalid refresh token');
    });

    it('returns 400 when refresh token is missing', async () => {
      const response = await request(app).post('/auth/logout').expect(400);

      expect(response.body.error.message).toBe('Validation failed');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'x-refresh-token', message: expect.any(String) }),
        ])
      );
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      await request(app).post('/auth/register').send({
        email: 'alice@example.com',
        displayName: 'Alice',
        password: 'Password123!',
      });

      const response = await request(app).post('/auth/login').send({
        email: 'alice@example.com',
        password: 'Password123!',
      });

      refreshToken = response.body.refreshToken;
    });

    it('returns a new access token and rotates the refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .set('x-refresh-token', refreshToken)
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.refreshToken).not.toBe(refreshToken);

      const payload = jwt.verify(response.body.accessToken, config.JWT_ACCESS_SECRET) as {
        sub: string;
      };
      expect(payload.sub).toBeDefined();

      const storedTokens = refreshTokenRepository['refreshTokens'];
      expect(storedTokens).toHaveLength(1);
      const storedToken = storedTokens[0]!;
      expect(storedToken.tokenHash).not.toBe(refreshToken);
    });

    it('returns 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .set('x-refresh-token', 'invalid-token')
        .expect(401);

      expect(response.body.error.message).toBe('Invalid refresh token');
    });

    it('returns 400 when refresh token is missing', async () => {
      const response = await request(app).post('/auth/refresh').expect(400);

      expect(response.body.error.message).toBe('Validation failed');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'x-refresh-token', message: expect.any(String) }),
        ])
      );
    });
  });

  describe('POST /auth/logout-all', () => {
    let refreshToken: string;

    beforeEach(async () => {
      await request(app).post('/auth/register').send({
        email: 'alice@example.com',
        displayName: 'Alice',
        password: 'Password123!',
      });

      await request(app).post('/auth/login').send({
        email: 'alice@example.com',
        password: 'Password123!',
      });

      const response = await request(app).post('/auth/login').send({
        email: 'alice@example.com',
        password: 'Password123!',
      });

      refreshToken = response.body.refreshToken;
    });

    it('deletes all refresh tokens except the current one', async () => {
      await request(app).post('/auth/logout-all').set('x-refresh-token', refreshToken).expect(204);

      const storedTokens = refreshTokenRepository['refreshTokens'];
      expect(storedTokens).toHaveLength(1);
      const storedToken = storedTokens[0]!;
      expect(storedToken.tokenHash).not.toBe(refreshToken);
    });

    it('returns 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/logout-all')
        .set('x-refresh-token', 'invalid-token')
        .expect(401);

      expect(response.body.error.message).toBe('Invalid refresh token');
    });

    it('returns 400 when refresh token is missing', async () => {
      const response = await request(app).post('/auth/logout-all').expect(400);

      expect(response.body.error.message).toBe('Validation failed');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'x-refresh-token', message: expect.any(String) }),
        ])
      );
    });
  });
});
