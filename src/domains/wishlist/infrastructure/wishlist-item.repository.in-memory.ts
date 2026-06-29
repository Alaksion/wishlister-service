import type { WishlistItem } from '../domain/wishlist-item.js';
import type { WishlistItemRepository } from '../application/wishlist-item.repository.js';

export class InMemoryWishlistItemRepository implements WishlistItemRepository {
  private items: WishlistItem[] = [];

  async findByUserId(userId: string): Promise<WishlistItem[]> {
    return this.items.filter((item) => item.userId === userId);
  }

  async deleteByUserId(userId: string): Promise<void> {
    this.items = this.items.filter((item) => item.userId !== userId);
  }

  add(item: WishlistItem): void {
    this.items.push(item);
  }

  clear(): void {
    this.items = [];
  }
}

export function createInMemoryWishlistItemRepository(): WishlistItemRepository {
  return new InMemoryWishlistItemRepository();
}
