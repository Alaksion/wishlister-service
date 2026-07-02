import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteWishlistItemUseCase } from './delete-wishlist-item.js';
import { InMemoryWishlistItemRepository } from '../infrastructure/wishlist-item.repository.in-memory.js';
import type { StorageService, UploadedObject } from '../../../shared/storage/storage-service.js';
import type { WishlistItem } from '../domain/wishlist-item.js';
import { NotFoundError } from '../../../shared/errors/app-error.js';

class FakeStorageService implements StorageService {
  uploadedObjects: Array<{ key: string; contentType: string }> = [];
  deletedKeys: string[] = [];
  movedObjects: Array<{ sourceKey: string; destinationKey: string }> = [];
  deleteObjectsFailure: Error | null = null;

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
    if (this.deleteObjectsFailure !== null) {
      throw this.deleteObjectsFailure;
    }
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

function createItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  const now = new Date();
  return {
    id: 'item-1',
    userId: 'user-1',
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

describe('DeleteWishlistItemUseCase', () => {
  let repository: InMemoryWishlistItemRepository;
  let storageService: FakeStorageService;
  let useCase: DeleteWishlistItemUseCase;

  beforeEach(() => {
    repository = new InMemoryWishlistItemRepository();
    storageService = new FakeStorageService();
    useCase = new DeleteWishlistItemUseCase(repository, storageService);
  });

  it('deletes an item without images without calling storage', async () => {
    repository.add(createItem({ images: [] }));

    await useCase.execute('item-1', 'user-1');

    expect(storageService.deletedKeys).toHaveLength(0);
    await expect(repository.findById('item-1')).resolves.toBeNull();
  });

  it('hard-deletes the record before deleting associated S3 objects', async () => {
    const item = createItem({
      images: [
        {
          s3Key: 'user-1/item-1/image1.png',
          url: 'https://example.com/user-1/item-1/image1.png',
          originalName: 'image1.png',
          uploadedAt: new Date(),
        },
        {
          s3Key: 'user-1/item-1/image2.png',
          url: 'https://example.com/user-1/item-1/image2.png',
          originalName: 'image2.png',
          uploadedAt: new Date(),
        },
      ],
    });
    repository.add(item);

    await useCase.execute('item-1', 'user-1');

    await expect(repository.findById('item-1')).resolves.toBeNull();
    expect(storageService.deletedKeys).toHaveLength(2);
    expect(storageService.deletedKeys).toContain('user-1/item-1/image1.png');
    expect(storageService.deletedKeys).toContain('user-1/item-1/image2.png');
  });

  it('throws NotFoundError and does not delete storage when item belongs to another user', async () => {
    const item = createItem({
      userId: 'user-2',
      images: [
        {
          s3Key: 'user-2/item-1/image1.png',
          url: 'https://example.com/user-2/item-1/image1.png',
          originalName: 'image1.png',
          uploadedAt: new Date(),
        },
      ],
    });
    repository.add(item);

    await expect(useCase.execute('item-1', 'user-1')).rejects.toThrow(NotFoundError);

    expect(storageService.deletedKeys).toHaveLength(0);
    await expect(repository.findById('item-1')).resolves.toEqual(item);
  });

  it('throws NotFoundError and does not delete storage when item does not exist', async () => {
    await expect(useCase.execute('missing-item', 'user-1')).rejects.toThrow(NotFoundError);

    expect(storageService.deletedKeys).toHaveLength(0);
  });

  it('throws and does not delete storage when the database deletion fails', async () => {
    class FailingRepository extends InMemoryWishlistItemRepository {
      async delete(_id: string): Promise<void> {
        throw new Error('DB delete failed');
      }
    }

    const failingRepository = new FailingRepository();
    const failingUseCase = new DeleteWishlistItemUseCase(failingRepository, storageService);
    const item = createItem({
      images: [
        {
          s3Key: 'user-1/item-1/image1.png',
          url: 'https://example.com/user-1/item-1/image1.png',
          originalName: 'image1.png',
          uploadedAt: new Date(),
        },
      ],
    });
    failingRepository.add(item);

    await expect(failingUseCase.execute('item-1', 'user-1')).rejects.toThrow('DB delete failed');

    expect(storageService.deletedKeys).toHaveLength(0);
    await expect(failingRepository.findById('item-1')).resolves.toEqual(item);
  });

  it('logs S3 deletion failures after the database record has been removed', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    storageService.deleteObjectsFailure = new Error('S3 deletion failed');
    const item = createItem({
      images: [
        {
          s3Key: 'user-1/item-1/image1.png',
          url: 'https://example.com/user-1/item-1/image1.png',
          originalName: 'image1.png',
          uploadedAt: new Date(),
        },
      ],
    });
    repository.add(item);

    await useCase.execute('item-1', 'user-1');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to delete S3 objects for item item-1 after DB deletion:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
    await expect(repository.findById('item-1')).resolves.toBeNull();
  });
});
