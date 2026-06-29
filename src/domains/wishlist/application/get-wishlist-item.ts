import type { WishlistItemRepository } from './wishlist-item.repository.js';
import type { WishlistItem } from '../domain/wishlist-item.js';
import { NotFoundError } from '../../../shared/errors/app-error.js';

export class GetWishlistItemUseCase {
  constructor(private readonly wishlistItemRepository: WishlistItemRepository) {}

  async execute(itemId: string, userId: string): Promise<WishlistItem> {
    const item = await this.wishlistItemRepository.findById(itemId);

    if (!item || item.userId !== userId) {
      throw new NotFoundError('Item not found');
    }

    return item;
  }
}
