import type { WishlistItem } from '../domain/wishlist-item.js';

export interface WishlistItemRepository {
  findByUserId(userId: string): Promise<WishlistItem[]>;
  deleteByUserId(userId: string): Promise<void>;
}
