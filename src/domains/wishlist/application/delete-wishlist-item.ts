import type { WishlistItemRepository } from './wishlist-item.repository.js';
import type { StorageService } from '../../../shared/storage/storage-service.js';
import { NotFoundError } from '../../../shared/errors/app-error.js';

export class DeleteWishlistItemUseCase {
  constructor(
    private readonly wishlistItemRepository: WishlistItemRepository,
    private readonly storageService: StorageService
  ) {}

  async execute(itemId: string, userId: string): Promise<void> {
    const item = await this.wishlistItemRepository.findById(itemId);

    if (!item || item.userId !== userId) {
      throw new NotFoundError('Item not found');
    }

    await this.wishlistItemRepository.delete(itemId);

    const s3Keys = item.images.map((image) => image.s3Key);
    if (s3Keys.length > 0) {
      try {
        await this.storageService.deleteObjects(s3Keys);
      } catch (error) {
        console.error(`Failed to delete S3 objects for item ${itemId} after DB deletion:`, error);
      }
    }
  }
}
