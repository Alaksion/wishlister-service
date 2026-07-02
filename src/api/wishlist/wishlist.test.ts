import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express, Request, Response } from 'express';
import { createApp } from '../../app.js';
import { RegisterUserUseCase } from '../../domains/user/application/register-user.js';
import { LoginUseCase } from '../../domains/user/application/login.js';
import { LogoutUseCase } from '../../domains/user/application/logout.js';
import { LogoutAllUseCase } from '../../domains/user/application/logout-all.js';
import { RefreshUseCase } from '../../domains/user/application/refresh.js';
import { CreateWishlistItemUseCase } from '../../domains/wishlist/application/create-wishlist-item.js';
import { ListWishlistItemsUseCase } from '../../domains/wishlist/application/list-wishlist-items.js';
import { GetWishlistItemUseCase } from '../../domains/wishlist/application/get-wishlist-item.js';
import { UpdateWishlistItemUseCase } from '../../domains/wishlist/application/update-wishlist-item.js';
import { DeleteWishlistItemUseCase } from '../../domains/wishlist/application/delete-wishlist-item.js';
import { InMemoryUserRepository } from '../../domains/user/infrastructure/user.repository.in-memory.js';
import { InMemoryRefreshTokenRepository } from '../../domains/refresh-token/infrastructure/refresh-token.repository.in-memory.js';
import { InMemoryWishlistItemRepository } from '../../domains/wishlist/infrastructure/wishlist-item.repository.in-memory.js';
import { createAuthMiddleware } from '../../shared/middleware/auth-middleware.js';
import { validateParams } from '../../shared/middleware/zod-validation.js';
import type { StorageService, UploadedObject } from '../../shared/storage/storage-service.js';
import { generateAccessToken } from '../../shared/tokens/token-service.js';
import {
  itemIdParamSchema,
  type WishlistItem,
} from '../../domains/wishlist/domain/wishlist-item.js';

class FakeStorageService implements StorageService {
  uploadedObjects: Array<{ key: string; contentType: string }> = [];
  deletedKeys: string[] = [];
  movedObjects: Array<{ sourceKey: string; destinationKey: string }> = [];

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
    const getWishlistItemUseCase = new GetWishlistItemUseCase(wishlistItemRepository);
    const updateWishlistItemUseCase = new UpdateWishlistItemUseCase(wishlistItemRepository);
    const deleteWishlistItemUseCase = new DeleteWishlistItemUseCase(
      wishlistItemRepository,
      storageService
    );

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
        getWishlistItemUseCase,
        updateWishlistItemUseCase,
        deleteWishlistItemUseCase,
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

  it('uploads images to a staging prefix before moving to the final key', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'staging@example.com',
      displayName: 'Staging',
      password: 'Password123!',
    });

    const userId = registerResponse.body.id;
    const accessToken = generateAccessToken(userId);
    const imageBuffer = createFakeImageBuffer();

    const response = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('title', 'Headphones')
      .attach('images', imageBuffer, 'image1.png')
      .expect(201);

    const finalKey = response.body.images[0].s3Key;
    expect(finalKey).toMatch(new RegExp(`^${userId}/${response.body.id}/[\\w-]+\\.png$`));
    expect(storageService.uploadedObjects[0]!.key).toBe(`staging/${finalKey}`);
    expect(storageService.movedObjects[0]).toEqual({
      sourceKey: `staging/${finalKey}`,
      destinationKey: finalKey,
    });
  });

  it('returns 400 for an unsupported image type', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'unsupported@example.com',
      displayName: 'Unsupported',
      password: 'Password123!',
    });

    const accessToken = generateAccessToken(registerResponse.body.id);

    const response = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('title', 'Thing')
      .attach('images', Buffer.from('not-an-image'), 'image.gif')
      .expect(400);

    expect(response.body.error.message).toBe(
      'Invalid image type: image/gif. Allowed types: image/jpeg, image/png, image/webp'
    );
    expect(storageService.uploadedObjects).toHaveLength(0);
  });

  it('returns 400 for an image larger than 5 MB', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'too-large@example.com',
      displayName: 'Too Large',
      password: 'Password123!',
    });

    const accessToken = generateAccessToken(registerResponse.body.id);
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);

    const response = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('title', 'Thing')
      .attach('images', largeBuffer, 'image.png')
      .expect(400);

    expect(response.body.error.message).toBe('Image exceeds maximum size of 5 MB');
    expect(storageService.uploadedObjects).toHaveLength(0);
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

  it('returns 400 for an invalid create payload', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'frank@example.com',
      displayName: 'Frank',
      password: 'Password123!',
    });

    const accessToken = generateAccessToken(registerResponse.body.id);

    const response = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('title', 'Thing')
      .field('priority', 'invalid-priority')
      .expect(400);

    expect(response.body.error.message).toBe('Validation failed');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.any(String), message: expect.any(String) }),
      ])
    );
  });

  it('returns 401 without authorization header', async () => {
    const response = await request(app).post('/items').field('title', 'Thing').expect(401);

    expect(response.body.error.message).toBe('Invalid or expired token');
  });

  it('returns 500 and does not create a record when persistence fails after staging upload', async () => {
    const userRepository = new InMemoryUserRepository();
    const storageService = new FakeStorageService();

    class FailingRepository extends InMemoryWishlistItemRepository {
      async create(_item: WishlistItem): Promise<WishlistItem> {
        throw new Error('DB write failed');
      }
    }
    const failingRepository = new FailingRepository();

    const registerUserUseCase = new RegisterUserUseCase(userRepository);
    const createWishlistItemUseCase = new CreateWishlistItemUseCase(
      failingRepository,
      storageService
    );

    const testApp = await createApp({
      authDependencies: {
        registerUserUseCase,
        loginUseCase: {} as unknown as LoginUseCase,
        logoutUseCase: {} as unknown as LogoutUseCase,
        logoutAllUseCase: {} as unknown as LogoutAllUseCase,
        refreshUseCase: {} as unknown as RefreshUseCase,
      },
      wishlistDependencies: {
        createWishlistItemUseCase,
        listWishlistItemsUseCase: {} as unknown as ListWishlistItemsUseCase,
        getWishlistItemUseCase: {} as unknown as GetWishlistItemUseCase,
        updateWishlistItemUseCase: {} as unknown as UpdateWishlistItemUseCase,
        deleteWishlistItemUseCase: {} as unknown as DeleteWishlistItemUseCase,
        authMiddleware: createAuthMiddleware(userRepository),
      },
    });

    const registerResponse = await request(testApp).post('/auth/register').send({
      email: 'persistence-fail@example.com',
      displayName: 'Persistence Fail',
      password: 'Password123!',
    });

    const accessToken = generateAccessToken(registerResponse.body.id);
    const imageBuffer = createFakeImageBuffer();

    const response = await request(testApp)
      .post('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('title', 'Headphones')
      .attach('images', imageBuffer, 'image1.png')
      .expect(500);

    expect(response.body.error.message).toBe('DB write failed');
    expect(storageService.uploadedObjects).toHaveLength(1);
    const items = await failingRepository.findByUserId(registerResponse.body.id);
    expect(items).toHaveLength(0);
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
    const getWishlistItemUseCase = new GetWishlistItemUseCase(wishlistItemRepository);
    const updateWishlistItemUseCase = new UpdateWishlistItemUseCase(wishlistItemRepository);
    const deleteWishlistItemUseCase = new DeleteWishlistItemUseCase(
      wishlistItemRepository,
      new FakeStorageService()
    );

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
        getWishlistItemUseCase,
        updateWishlistItemUseCase,
        deleteWishlistItemUseCase,
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

  it('returns 400 for invalid query parameters', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const accessToken = generateAccessToken(registerResponse.body.id);

    const response = await request(app)
      .get('/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ limit: 'not-a-number' })
      .expect(400);

    expect(response.body.error.message).toBe('Validation failed');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.any(String), message: expect.any(String) }),
      ])
    );
  });
});

describe('GET /items/:id and PATCH /items/:id', () => {
  let app: Express;
  let userRepository: InMemoryUserRepository;
  let wishlistItemRepository: InMemoryWishlistItemRepository;

  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    wishlistItemRepository = new InMemoryWishlistItemRepository();

    const registerUserUseCase = new RegisterUserUseCase(userRepository);
    const getWishlistItemUseCase = new GetWishlistItemUseCase(wishlistItemRepository);
    const updateWishlistItemUseCase = new UpdateWishlistItemUseCase(wishlistItemRepository);
    const deleteWishlistItemUseCase = new DeleteWishlistItemUseCase(
      wishlistItemRepository,
      new FakeStorageService()
    );

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
        listWishlistItemsUseCase: {} as unknown as ListWishlistItemsUseCase,
        getWishlistItemUseCase,
        updateWishlistItemUseCase,
        deleteWishlistItemUseCase,
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
      currency: 'USD',
      priority: 'medium',
      isPurchased: false,
      images: [],
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  it('returns the item if owned by the authenticated user', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const userId = registerResponse.body.id;
    const accessToken = generateAccessToken(userId);

    const item = createItem(userId, { title: 'My Item' });
    wishlistItemRepository.add(item);

    const response = await request(app)
      .get(`/items/${item.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.title).toBe('My Item');
    expect(response.body.createdAt).toBeDefined();
    expect(response.body.updatedAt).toBeDefined();
  });

  it('returns 404 for another users item', async () => {
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

    const item = createItem(bobResponse.body.id, { title: 'Bob Item' });
    wishlistItemRepository.add(item);

    const accessToken = generateAccessToken(aliceResponse.body.id);

    const response = await request(app)
      .get(`/items/${item.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body.error.message).toBe('Item not found');
  });

  it('supports partial updates including toggling isPurchased', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const userId = registerResponse.body.id;
    const accessToken = generateAccessToken(userId);

    const item = createItem(userId, { title: 'Old Title', price: 1000 });
    wishlistItemRepository.add(item);

    const response = await request(app)
      .patch(`/items/${item.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'New Title', isPurchased: true })
      .expect(200);

    expect(response.body.title).toBe('New Title');
    expect(response.body.price).toBe(1000);
    expect(response.body.isPurchased).toBe(true);
  });

  it('returns 404 when updating another users item', async () => {
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

    const item = createItem(bobResponse.body.id);
    wishlistItemRepository.add(item);

    const accessToken = generateAccessToken(aliceResponse.body.id);

    const response = await request(app)
      .patch(`/items/${item.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Hacked' })
      .expect(404);

    expect(response.body.error.message).toBe('Item not found');
  });

  it('returns 400 for an invalid update payload', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const userId = registerResponse.body.id;
    const accessToken = generateAccessToken(userId);

    const item = createItem(userId, { title: 'Old Title' });
    wishlistItemRepository.add(item);

    const response = await request(app)
      .patch(`/items/${item.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: 'not-a-url' })
      .expect(400);

    expect(response.body.error.message).toBe('Validation failed');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.any(String), message: expect.any(String) }),
      ])
    );
  });

  it('deletes the item and its images if owned by the authenticated user', async () => {
    const registerResponse = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'Password123!',
    });

    const userId = registerResponse.body.id;
    const accessToken = generateAccessToken(userId);
    const storageService = new FakeStorageService();

    const createWishlistItemUseCase = new CreateWishlistItemUseCase(
      wishlistItemRepository,
      storageService
    );
    const deleteWishlistItemUseCase = new DeleteWishlistItemUseCase(
      wishlistItemRepository,
      storageService
    );

    const createdItem = await createWishlistItemUseCase.execute(
      {
        title: 'Thing',
        currency: 'USD',
        priority: 'medium',
      },
      userId,
      [
        {
          buffer: createFakeImageBuffer(),
          originalname: 'image1.png',
          mimetype: 'image/png',
          size: 1000,
        },
      ]
    );

    app = await createApp({
      authDependencies: {
        registerUserUseCase: new RegisterUserUseCase(userRepository),
        loginUseCase: {} as unknown as LoginUseCase,
        logoutUseCase: {} as unknown as LogoutUseCase,
        logoutAllUseCase: {} as unknown as LogoutAllUseCase,
        refreshUseCase: {} as unknown as RefreshUseCase,
      },
      wishlistDependencies: {
        createWishlistItemUseCase: {} as unknown as CreateWishlistItemUseCase,
        listWishlistItemsUseCase: {} as unknown as ListWishlistItemsUseCase,
        getWishlistItemUseCase: {} as unknown as GetWishlistItemUseCase,
        updateWishlistItemUseCase: {} as unknown as UpdateWishlistItemUseCase,
        deleteWishlistItemUseCase,
        authMiddleware: createAuthMiddleware(userRepository),
      },
    });

    await request(app)
      .delete(`/items/${createdItem.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    expect(storageService.deletedKeys).toHaveLength(1);
    expect(storageService.deletedKeys[0]).toBe(createdItem.images[0]!.s3Key);
    await expect(wishlistItemRepository.findById(createdItem.id)).resolves.toBeNull();
  });

  it('returns 404 when deleting another users item', async () => {
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

    const item = createItem(bobResponse.body.id);
    wishlistItemRepository.add(item);

    const accessToken = generateAccessToken(aliceResponse.body.id);

    const response = await request(app)
      .delete(`/items/${item.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    expect(response.body.error.message).toBe('Item not found');
    await expect(wishlistItemRepository.findById(item.id)).resolves.toBeDefined();
  });
});

describe('route param validation', () => {
  it('rejects an empty item id with a standardized 400 error', () => {
    const req = { params: { id: '' } } as unknown as Request;
    const res = {} as unknown as Response;
    const next = vi.fn();

    validateParams(itemIdParamSchema)(req, res, next);

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
