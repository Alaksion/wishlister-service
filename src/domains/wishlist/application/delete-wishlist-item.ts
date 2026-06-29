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

    const s3Keys = item.images.map((image) => image.s3Key);
    if (s3Keys.length > 0) {
      await this.storageService.deleteObjects(s3Keys);
    }

    await this.wishlistItemRepository.delete(itemId);
  }
}
