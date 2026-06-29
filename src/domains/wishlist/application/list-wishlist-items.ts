import { z } from 'zod';
import type { WishlistItemRepository, ListItemsOptions } from './wishlist-item.repository.js';
import type { WishlistItem } from '../domain/wishlist-item.js';

export const sortFieldSchema = z.enum(['createdAt', 'price', 'priority']);
export const sortDirectionSchema = z.enum(['asc', 'desc']).default('desc');

export const listWishlistItemsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  isPurchased: z.coerce.boolean().optional(),
  sortBy: sortFieldSchema.default('createdAt'),
  sortDirection: sortDirectionSchema,
});

export type ListWishlistItemsInput = z.infer<typeof listWishlistItemsSchema>;

export interface ListWishlistItemsResult {
  items: WishlistItem[];
  nextCursor: string | null;
}

function encodeCursor(cursor: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    })
  ).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8')) as {
    createdAt: string;
    id: string;
  };
  return {
    createdAt: new Date(parsed.createdAt),
    id: parsed.id,
  };
}

export class ListWishlistItemsUseCase {
  constructor(private readonly wishlistItemRepository: WishlistItemRepository) {}

  async execute(input: ListWishlistItemsInput, userId: string): Promise<ListWishlistItemsResult> {
    const validated = listWishlistItemsSchema.parse(input);

    const options: ListItemsOptions = {
      userId,
      limit: validated.limit,
      sortBy: validated.sortBy,
      sortDirection: validated.sortDirection,
    };

    if (validated.cursor) {
      options.cursor = decodeCursor(validated.cursor);
    }

    if (validated.search) {
      options.search = validated.search;
    }

    if (validated.priority) {
      options.priority = validated.priority;
    }

    if (validated.isPurchased !== undefined) {
      options.isPurchased = validated.isPurchased;
    }

    const result = await this.wishlistItemRepository.list(options);

    return {
      items: result.items,
      nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : null,
    };
  }
}
