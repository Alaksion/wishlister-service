import { ObjectId } from 'mongodb';
import type { WishlistItem } from '../domain/wishlist-item.js';
import type { WishlistItemRepository } from '../application/wishlist-item.repository.js';

export class InMemoryWishlistItemRepository implements WishlistItemRepository {
  private items: WishlistItem[] = [];

  async create(item: Omit<WishlistItem, 'id'>): Promise<WishlistItem> {
    const created: WishlistItem = {
      ...item,
      id: new ObjectId().toHexString(),
    };
    this.items.push(created);
    return created;
  }

  async findByUserId(userId: string): Promise<WishlistItem[]> {
    return this.items.filter((item) => item.userId === userId);
  }

  async findById(id: string): Promise<WishlistItem | null> {
    return this.items.find((item) => item.id === id) ?? null;
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
