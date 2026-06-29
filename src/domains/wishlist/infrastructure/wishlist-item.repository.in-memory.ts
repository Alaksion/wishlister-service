import { ObjectId } from 'mongodb';
import type { WishlistItem } from '../domain/wishlist-item.js';
import type {
  ListItemsOptions,
  PaginatedWishlistItems,
  WishlistItemRepository,
} from '../application/wishlist-item.repository.js';

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

  async list(options: ListItemsOptions): Promise<PaginatedWishlistItems> {
    const filtered = this.items.filter((item) => {
      if (item.userId !== options.userId) return false;
      if (options.priority && item.priority !== options.priority) return false;
      if (options.isPurchased !== undefined && item.isPurchased !== options.isPurchased)
        return false;
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        const titleMatch = item.title.toLowerCase().includes(searchLower);
        const descriptionMatch = item.description?.toLowerCase().includes(searchLower) ?? false;
        if (!titleMatch && !descriptionMatch) return false;
      }
      return true;
    });

    filtered.sort((a, b) => this.compareItems(a, b, options.sortBy, options.sortDirection));

    let startIndex = 0;
    if (options.cursor) {
      const cursorDate = options.cursor.createdAt;
      const sortDirection = options.sortDirection;
      startIndex = filtered.findIndex((item) => {
        const dateComparison = item.createdAt.getTime() - cursorDate.getTime();
        if (dateComparison === 0) {
          return item.id > options.cursor!.id;
        }
        return sortDirection === 'asc' ? dateComparison > 0 : dateComparison < 0;
      });
      if (startIndex === -1) {
        startIndex = filtered.length;
      }
    }

    const pageItems = filtered.slice(startIndex, startIndex + options.limit);
    const hasMore = startIndex + options.limit < filtered.length;

    return {
      items: pageItems,
      nextCursor: hasMore
        ? {
            createdAt: pageItems[pageItems.length - 1]!.createdAt,
            id: pageItems[pageItems.length - 1]!.id,
          }
        : null,
    };
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

  private compareItems(
    a: WishlistItem,
    b: WishlistItem,
    sortBy: 'createdAt' | 'price' | 'priority',
    sortDirection: 'asc' | 'desc'
  ): number {
    let comparison = 0;

    switch (sortBy) {
      case 'createdAt':
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
        break;
      case 'price': {
        const priceA = a.price ?? 0;
        const priceB = b.price ?? 0;
        comparison = priceA - priceB;
        break;
      }
      case 'priority': {
        const priorityOrder = { low: 0, medium: 1, high: 2 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
      }
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  }
}

export function createInMemoryWishlistItemRepository(): WishlistItemRepository {
  return new InMemoryWishlistItemRepository();
}
