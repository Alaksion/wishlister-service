import type { WishlistItem } from '../domain/wishlist-item.js';

export interface WishlistItemRepository {
  create(item: Omit<WishlistItem, 'id'>): Promise<WishlistItem>;
  findByUserId(userId: string): Promise<WishlistItem[]>;
  findById(id: string): Promise<WishlistItem | null>;
  deleteByUserId(userId: string): Promise<void>;
}
