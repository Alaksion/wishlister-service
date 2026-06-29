import type { WishlistItem } from '../domain/wishlist-item.js';

export interface ListItemsOptions {
  userId: string;
  cursor?: { createdAt: Date; id: string };
  limit: number;
  search?: string;
  priority?: 'low' | 'medium' | 'high';
  isPurchased?: boolean;
  sortBy: 'createdAt' | 'price' | 'priority';
  sortDirection: 'asc' | 'desc';
}

export interface PaginatedWishlistItems {
  items: WishlistItem[];
  nextCursor: { createdAt: Date; id: string } | null;
}

export interface WishlistItemRepository {
  create(item: Omit<WishlistItem, 'id'>): Promise<WishlistItem>;
  findByUserId(userId: string): Promise<WishlistItem[]>;
  list(options: ListItemsOptions): Promise<PaginatedWishlistItems>;
  findById(id: string): Promise<WishlistItem | null>;
  update(id: string, item: WishlistItem): Promise<WishlistItem>;
  deleteByUserId(userId: string): Promise<void>;
}
