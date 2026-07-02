import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateWishlistItemUseCase, type ImageFile } from './create-wishlist-item.js';
import { InMemoryWishlistItemRepository } from '../../../test/fakes/wishlist-item.repository.in-memory.js';
import {
  FakeStorageService,
  createFakeImageBuffer,
} from '../../../test/fakes/fake-storage-service.js';
import type { WishlistItem } from '../domain/wishlist-item.js';

function createImageFile(overrides: Partial<ImageFile> = {}): ImageFile {
  return {
    buffer: createFakeImageBuffer(),
    originalname: 'image.png',
    mimetype: 'image/png',
    size: 1000,
    ...overrides,
  };
}

describe('CreateWishlistItemUseCase', () => {
  let repository: InMemoryWishlistItemRepository;
  let storageService: FakeStorageService;
  let useCase: CreateWishlistItemUseCase;

  beforeEach(() => {
    repository = new InMemoryWishlistItemRepository();
    storageService = new FakeStorageService();
    useCase = new CreateWishlistItemUseCase(repository, storageService);
  });

  it('creates an item without images', async () => {
    const result = await useCase.execute(
      {
        title: 'New Bike',
        currency: 'USD',
        priority: 'medium',
      },
      'user-1'
    );

    expect(result.title).toBe('New Bike');
    expect(result.userId).toBe('user-1');
    expect(result.images).toEqual([]);
    expect(storageService.uploadedObjects).toHaveLength(0);
    expect(storageService.movedObjects).toHaveLength(0);
  });

  it('uploads images to a staging prefix first', async () => {
    await useCase.execute(
      {
        title: 'Headphones',
        currency: 'USD',
        priority: 'medium',
      },
      'user-1',
      [createImageFile(), createImageFile({ originalname: 'image2.jpg', mimetype: 'image/jpeg' })]
    );

    expect(storageService.uploadedObjects).toHaveLength(2);
    expect(storageService.uploadedObjects[0]!.key).toMatch(
      /^staging\/user-1\/[\w-]+\/[\w-]+\.png$/
    );
    expect(storageService.uploadedObjects[1]!.key).toMatch(
      /^staging\/user-1\/[\w-]+\/[\w-]+\.jpg$/
    );
  });

  it('persists the item with final s3Key following {userId}/{itemId}/{randomName}', async () => {
    const result = await useCase.execute(
      {
        title: 'Headphones',
        currency: 'USD',
        priority: 'medium',
      },
      'user-1',
      [createImageFile()]
    );

    expect(result.images).toHaveLength(1);
    expect(result.images[0]!.s3Key).toMatch(/^user-1\/[\w-]+\/[\w-]+\.png$/);
    expect(result.images[0]!.url).toBe(`https://example.com/${result.images[0]!.s3Key}`);
  });

  it('moves each object from staging to final key after DB persistence', async () => {
    const result = await useCase.execute(
      {
        title: 'Headphones',
        currency: 'USD',
        priority: 'medium',
      },
      'user-1',
      [createImageFile(), createImageFile({ originalname: 'image2.png' })]
    );

    expect(storageService.movedObjects).toHaveLength(2);

    const storedItem = await repository.findById(result.id);
    expect(storedItem).not.toBeNull();

    for (let i = 0; i < result.images.length; i++) {
      const finalKey = result.images[i]!.s3Key;
      const stagingKey = storageService.uploadedObjects[i]!.key;
      expect(stagingKey).toBe(`staging/${finalKey}`);
      expect(storageService.movedObjects[i]).toEqual({
        sourceKey: stagingKey,
        destinationKey: finalKey,
      });
    }
  });

  it('does not create a DB record if staging upload fails', async () => {
    storageService.uploadFailures.set('match-any', new Error('Upload failed'));

    await expect(
      useCase.execute(
        {
          title: 'Headphones',
          currency: 'USD',
          priority: 'medium',
        },
        'user-1',
        [createImageFile()]
      )
    ).rejects.toThrow('Upload failed');

    const items = await repository.findByUserId('user-1');
    expect(items).toHaveLength(0);
  });

  it('does not keep a DB record if persistence fails after staging upload', async () => {
    class FailingRepository extends InMemoryWishlistItemRepository {
      async create(_item: Omit<WishlistItem, 'id'>): Promise<WishlistItem> {
        throw new Error('DB write failed');
      }
    }
    const failingRepository = new FailingRepository();
    const failingUseCase = new CreateWishlistItemUseCase(failingRepository, storageService);

    await expect(
      failingUseCase.execute(
        {
          title: 'Headphones',
          currency: 'USD',
          priority: 'medium',
        },
        'user-1',
        [createImageFile()]
      )
    ).rejects.toThrow('DB write failed');

    expect(storageService.uploadedObjects).toHaveLength(1);
    const items = await failingRepository.findByUserId('user-1');
    expect(items).toHaveLength(0);
  });

  it('rejects unsupported image types before any storage call', async () => {
    await expect(
      useCase.execute(
        {
          title: 'Headphones',
          currency: 'USD',
          priority: 'medium',
        },
        'user-1',
        [createImageFile({ mimetype: 'image/gif' })]
      )
    ).rejects.toThrow('Invalid image type');

    expect(storageService.uploadedObjects).toHaveLength(0);
  });

  it('keeps the final s3Key when moving a staged object fails', async () => {
    storageService.moveFailures.set('match-any', new Error('Move failed'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await useCase.execute(
      {
        title: 'Headphones',
        currency: 'USD',
        priority: 'medium',
      },
      'user-1',
      [createImageFile(), createImageFile({ originalname: 'image2.png' })]
    );

    consoleErrorSpy.mockRestore();

    expect(result.images).toHaveLength(2);
    expect(storageService.movedObjects).toHaveLength(0);
    expect(result.images[0]!.s3Key).toMatch(/^user-1\/[\w-]+\/[\w-]+\.png$/);

    const storedItem = await repository.findById(result.id);
    expect(storedItem!.images[0]!.s3Key).toBe(result.images[0]!.s3Key);
  });

  it('rejects images larger than 5 MB', async () => {
    await expect(
      useCase.execute(
        {
          title: 'Headphones',
          currency: 'USD',
          priority: 'medium',
        },
        'user-1',
        [createImageFile({ size: 6 * 1024 * 1024 })]
      )
    ).rejects.toThrow('Image exceeds maximum size of 5 MB');
  });
});
