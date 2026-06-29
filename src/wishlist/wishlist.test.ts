import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { RegisterUserUseCase } from '../domains/user/application/register-user.js';
import { LoginUseCase } from '../domains/user/application/login.js';
import { LogoutUseCase } from '../domains/user/application/logout.js';
import { LogoutAllUseCase } from '../domains/user/application/logout-all.js';
import { RefreshUseCase } from '../domains/user/application/refresh.js';
import { CreateWishlistItemUseCase } from '../domains/wishlist/application/create-wishlist-item.js';
import { ListWishlistItemsUseCase } from '../domains/wishlist/application/list-wishlist-items.js';
import { InMemoryUserRepository } from '../domains/user/infrastructure/user.repository.in-memory.js';
import { InMemoryRefreshTokenRepository } from '../domains/refresh-token/infrastructure/refresh-token.repository.in-memory.js';
import { InMemoryWishlistItemRepository } from '../domains/wishlist/infrastructure/wishlist-item.repository.in-memory.js';
import { createAuthMiddleware } from '../shared/middleware/auth-middleware.js';
import type { StorageService, UploadedObject } from '../shared/storage/storage-service.js';
import { generateAccessToken } from '../shared/tokens/token-service.js';
import type { WishlistItem } from '../domains/wishlist/domain/wishlist-item.js';

class FakeStorageService implements StorageService {
  uploadedObjects: Array<{ key: string; contentType: string }> = [];
  deletedKeys: string[] = [];

  async uploadObject(key: string, buffer: Buffer, contentType: string): Promise<UploadedObject> {
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
}

function createFakeImageBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

describe('POST /items', () => {
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
    const createWishlistItemUseCase = new CreateWishlistItemUseCase(
      wishlistItemRepository,
      storageService
    );
    const listWishlistItemsUseCase = new ListWishlistItemsUseCase(wishlistItemRepository);

    app = await createApp({
      authDependencies: {
        registerUserUseCase,
        loginUseCase,
        logoutUseCase: {} as unknown as LogoutUseCase,
        logoutAllUseCase: {} as unknown as LogoutAllUseCase,
        refreshUseCase: {} as unknown as RefreshUseCase,
      },
      wishlistDependencies: {
        createWishlistItemUseCase,
        listWishlistItemsUseCase,
        authMiddleware: createAuthMiddleware(userRepository),
      },
    });
  });

  it('creates an item owned by the authenticated user', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const accessToken = generateAccessToken(registerResponse.body.id);

    const response = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('title', 'New Bike')
      .field('description', 'A cool bike')
      .field('url', 'https://example.com/bike')
      .field('price', '25000')
      .field('currency', 'USD')
      .field('priority', 'high')
      .expect(201);

    expect(response.body.title).toBe('New Bike');
    expect(response.body.description).toBe('A cool bike');
    expect(response.body.url).toBe('https://example.com/bike');
    expect(response.body.price).toBe(25000);
    expect(response.body.currency).toBe('USD');
    expect(response.body.priority).toBe('high');
    expect(response.body.isPurchased).toBe(false);
    expect(response.body.userId).toBe(registerResponse.body.id);
    expect(response.body.images).toEqual([]);
  });

  it('accepts up to 3 images and stores s3Key and url', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'bob@example.com',
      displayName: 'Bob',
      password: 'Password123!',
    });

    const accessToken = generateAccessToken(registerResponse.body.id);
    const imageBuffer = createFakeImageBuffer();

    const response = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('title', 'Headphones')
      .attach('images', imageBuffer, 'image1.png')
      .attach('images', imageBuffer, 'image2.png')
      .expect(201);

    expect(response.body.images).toHaveLength(2);
    expect(response.body.images[0].s3Key).toBeDefined();
    expect(response.body.images[0].url).toBeDefined();
    expect(storageService.uploadedObjects).toHaveLength(2);
  });

  it('returns 400 for missing title', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'charlie@example.com',
      displayName: 'Charlie',
      password: 'Password123!',
    });

    const accessToken = generateAccessToken(registerResponse.body.id);

    const response = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('priority', 'low')
      .expect(400);

    expect(response.body.error.message).toBe('Validation failed');
  });

  it('returns 400 for invalid URL', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'dave@example.com',
      displayName: 'Dave',
      password: 'Password123!',
    });

    const accessToken = generateAccessToken(registerResponse.body.id);

    const response = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('title', 'Thing')
      .field('url', 'not-a-url')
      .expect(400);

    expect(response.body.error.message).toBe('Validation failed');
  });

  it('returns 401 without authorization header', async () => {
    const response = await request(app).post('/items').field('title', 'Thing').expect(401);

    expect(response.body.error.message).toBe('Invalid or expired token');
  });
});

describe('GET /items', () => {
  let app: Express;
  let userRepository: InMemoryUserRepository;
  let wishlistItemRepository: InMemoryWishlistItemRepository;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    wishlistItemRepository = new InMemoryWishlistItemRepository();

    const registerUserUseCase = new RegisterUserUseCase(userRepository);
    const listWishlistItemsUseCase = new ListWishlistItemsUseCase(wishlistItemRepository);

    app = await createApp({
      authDependencies: {
        registerUserUseCase,
        loginUseCase: {} as unknown as LoginUseCase,
        logoutUseCase: {} as unknown as LogoutUseCase,
        logoutAllUseCase: {} as unknown as LogoutAllUseCase,
        refreshUseCase: {} as unknown as RefreshUseCase,
      },
      wishlistDependencies: {
        createWishlistItemUseCase: {} as unknown as CreateWishlistItemUseCase,
        listWishlistItemsUseCase,
        authMiddleware: createAuthMiddleware(userRepository),
      },
    });
  });

  function createItem(userId: string, overrides: Partial<WishlistItem> = {}): WishlistItem {
    const now = new Date();
    return {
      id: `item-${Math.random().toString(36).slice(2)}`,
      userId,
      title: 'Item',
      description: '',
      currency: 'USD',
      priority: 'medium',
      isPurchased: false,
      images: [],
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  it('returns only items belonging to the authenticated user', async () => {
    const aliceResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const bobResponse = await request(app).post('/auth/register').send({
      email: 'bob@example.com',
      displayName: 'Bob',
      password: 'Password123!',
    });

    wishlistItemRepository.add(createItem(aliceResponse.body.id, { title: 'Alice Item' }));
    wishlistItemRepository.add(createItem(bobResponse.body.id, { title: 'Bob Item' }));

    const accessToken = generateAccessToken(aliceResponse.body.id);

    const response = await request(app)
      .get('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].title).toBe('Alice Item');
    expect(response.body.nextCursor).toBeNull();
  });

  it('supports cursor-based pagination', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const userId = registerResponse.body.id;
    const accessToken = generateAccessToken(userId);

    for (let i = 0; i < 25; i++) {
      wishlistItemRepository.add(
        createItem(userId, {
          title: `Item ${i}`,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
        })
      );
    }

    const firstPage = await request(app)
      .get('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ limit: 10 })
      .expect(200);

    expect(firstPage.body.items).toHaveLength(10);
    expect(firstPage.body.nextCursor).toBeDefined();

    const secondPage = await request(app)
      .get('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ limit: 10, cursor: firstPage.body.nextCursor })
      .expect(200);

    expect(secondPage.body.items).toHaveLength(10);
    expect(secondPage.body.nextCursor).toBeDefined();

    const thirdPage = await request(app)
      .get('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ limit: 10, cursor: secondPage.body.nextCursor })
      .expect(200);

    expect(thirdPage.body.items).toHaveLength(5);
    expect(thirdPage.body.nextCursor).toBeNull();
  });

  it('filters by text search on title and description', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const userId = registerResponse.body.id;
    const accessToken = generateAccessToken(userId);

    wishlistItemRepository.add(createItem(userId, { title: 'Mountain Bike' }));
    wishlistItemRepository.add(createItem(userId, { title: 'Thing', description: 'A fast bike' }));
    wishlistItemRepository.add(createItem(userId, { title: 'Headphones' }));

    const response = await request(app)
      .get('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ search: 'bike' })
      .expect(200);

    expect(response.body.items).toHaveLength(2);
  });

  it('filters by priority', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const userId = registerResponse.body.id;
    const accessToken = generateAccessToken(userId);

    wishlistItemRepository.add(createItem(userId, { priority: 'low' }));
    wishlistItemRepository.add(createItem(userId, { priority: 'high' }));

    const response = await request(app)
      .get('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ priority: 'high' })
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].priority).toBe('high');
  });

  it('filters by isPurchased', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const userId = registerResponse.body.id;
    const accessToken = generateAccessToken(userId);

    wishlistItemRepository.add(createItem(userId, { title: 'Bought', isPurchased: true }));
    wishlistItemRepository.add(createItem(userId, { title: 'Pending', isPurchased: false }));

    const response = await request(app)
      .get('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ isPurchased: 'true' })
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].title).toBe('Bought');
  });

  it('supports sorting by price descending', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const userId = registerResponse.body.id;
    const accessToken = generateAccessToken(userId);

    wishlistItemRepository.add(createItem(userId, { title: 'Cheap', price: 1000 }));
    wishlistItemRepository.add(createItem(userId, { title: 'Expensive', price: 5000 }));

    const response = await request(app)
      .get('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ sortBy: 'price', sortDirection: 'desc' })
      .expect(200);

    expect(response.body.items[0].title).toBe('Expensive');
    expect(response.body.items[1].title).toBe('Cheap');
  });
});
