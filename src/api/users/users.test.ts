import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';
import { RegisterUserUseCase } from '../../domains/user/application/register-user.js';
import { LoginUseCase } from '../../domains/user/application/login.js';
import { DeactivateUserUseCase } from '../../domains/user/application/deactivate-user.js';
import { LogoutUseCase } from '../../domains/user/application/logout.js';
import { LogoutAllUseCase } from '../../domains/user/application/logout-all.js';
import { RefreshUseCase } from '../../domains/user/application/refresh.js';
import { InMemoryUserRepository } from '../../domains/user/infrastructure/user.repository.in-memory.js';
import { InMemoryRefreshTokenRepository } from '../../domains/refresh-token/infrastructure/refresh-token.repository.in-memory.js';
import { InMemoryWishlistItemRepository } from '../../domains/wishlist/infrastructure/wishlist-item.repository.in-memory.js';
import { createAuthMiddleware } from '../../shared/middleware/auth-middleware.js';
import type { StorageService, UploadedObject } from '../../shared/storage/storage-service.js';
import { generateAccessToken } from '../../shared/tokens/token-service.js';

class FakeStorageService implements StorageService {
  uploadedObjects: Array<{ key: string; contentType: string }> = [];
  deletedKeys: string[] = [];
  movedObjects: Array<{ sourceKey: string; destinationKey: string }> = [];

  async uploadObject(key: string, _buffer: Buffer, contentType: string): Promise<UploadedObject> {
    this.uploadedObjects.push({ key, contentType });
    return {
      key,
      url: `https://example.com/${key}`,
    };
  }

  async deleteObject(key: string): Promise<void> {
    this.deletedKeys.push(key);
  }

  async deleteObjects(keys: string[]): Promise<void> {
    this.deletedKeys.push(...keys);
  }

  async moveObject(sourceKey: string, destinationKey: string): Promise<UploadedObject> {
    this.movedObjects.push({ sourceKey, destinationKey });
    return {
      key: destinationKey,
      url: `https://example.com/${destinationKey}`,
    };
  }

  getObjectUrl(key: string): string {
    return `https://example.com/${key}`;
  }
}

describe('DELETE /users/me', () => {
  let app: Express;
  let userRepository: InMemoryUserRepository;
  let refreshTokenRepository: InMemoryRefreshTokenRepository;
  let wishlistItemRepository: InMemoryWishlistItemRepository;
  let storageService: FakeStorageService;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    refreshTokenRepository = new InMemoryRefreshTokenRepository();
    wishlistItemRepository = new InMemoryWishlistItemRepository();
    storageService = new FakeStorageService();

    const registerUserUseCase = new RegisterUserUseCase(userRepository);
    const loginUseCase = new LoginUseCase(userRepository, refreshTokenRepository);
    const deactivateUserUseCase = new DeactivateUserUseCase(
      userRepository,
      refreshTokenRepository,
      wishlistItemRepository,
      storageService
    );

    app = await createApp({
      authDependencies: {
        registerUserUseCase,
        loginUseCase,
        logoutUseCase: new LogoutUseCase(refreshTokenRepository),
        logoutAllUseCase: new LogoutAllUseCase(refreshTokenRepository),
        refreshUseCase: new RefreshUseCase(refreshTokenRepository),
      },
      usersDependencies: {
        deactivateUserUseCase,
        authMiddleware: createAuthMiddleware(userRepository),
      },
    });
  });

  it('deactivates the authenticated user', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const accessToken = generateAccessToken(registerResponse.body.id);

    await request(app)
      .delete('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const user = await userRepository.findById(registerResponse.body.id);
    expect(user?.isActive).toBe(false);
  });

  it('deletes all refresh tokens for the user', async () => {
    await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const loginResponse = await request(app).post('/auth/login').send({
      email: 'alice@example.com',
      password: 'Password123!',
    });

    const accessToken = loginResponse.body.accessToken;

    await request(app)
      .delete('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const storedTokens = refreshTokenRepository['refreshTokens'];
    expect(storedTokens).toHaveLength(0);
  });

  it('deletes all wishlist items and their S3 objects', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const userId = registerResponse.body.id;
    const accessToken = generateAccessToken(userId);

    wishlistItemRepository.add({
      id: 'item-1',
      userId,
      title: 'Item 1',
      currency: 'USD',
      priority: 'medium',
      isPurchased: false,
      images: [
        {
          s3Key: 'user/alice/image1.jpg',
          url: 'https://example.com/image1.jpg',
          uploadedAt: new Date(),
        },
        {
          s3Key: 'user/alice/image2.jpg',
          url: 'https://example.com/image2.jpg',
          uploadedAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app)
      .delete('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const items = await wishlistItemRepository.findByUserId(userId);
    expect(items).toHaveLength(0);
    expect(storageService.deletedKeys).toEqual(['user/alice/image1.jpg', 'user/alice/image2.jpg']);
  });

  it('returns 401 for subsequent requests after deactivation', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const accessToken = generateAccessToken(registerResponse.body.id);

    await request(app)
      .delete('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const response = await request(app)
      .delete('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(response.body.error.message).toBe('Invalid or expired token');
  });

  it('returns 401 without authorization header', async () => {
    const response = await request(app).delete('/users/me').expect(401);

    expect(response.body.error.message).toBe('Invalid or expired token');
  });
});
