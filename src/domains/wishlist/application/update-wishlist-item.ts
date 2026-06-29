import { z } from 'zod';
import type { WishlistItemRepository } from './wishlist-item.repository.js';
import type { WishlistItem } from '../domain/wishlist-item.js';
import { NotFoundError } from '../../../shared/errors/app-error.js';

export const updateWishlistItemSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .optional(),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or less')
    .optional()
    .or(z.literal('')),
  url: z.string().url('Invalid URL format').optional().or(z.literal('')),
  price: z.coerce
    .number()
    .int('Price must be an integer')
    .nonnegative('Price cannot be negative')
    .optional(),
  currency: z.string().min(3).max(3).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  isPurchased: z.boolean().optional(),
});

export type UpdateWishlistItemInput = z.infer<typeof updateWishlistItemSchema>;

export class UpdateWishlistItemUseCase {
  constructor(private readonly wishlistItemRepository: WishlistItemRepository) {}

  async execute(
    itemId: string,
    userId: string,
    input: UpdateWishlistItemInput
  ): Promise<WishlistItem> {
    const validated = updateWishlistItemSchema.parse(input);

    const existingItem = await this.wishlistItemRepository.findById(itemId);

    if (!existingItem || existingItem.userId !== userId) {
      throw new NotFoundError('Item not found');
    }

    const updatedItem: WishlistItem = {
      ...existingItem,
      updatedAt: new Date(),
    };

    if (validated.title !== undefined) {
      updatedItem.title = validated.title.trim();
    }

    if (validated.description !== undefined) {
      const trimmed = validated.description.trim();
      if (trimmed) {
        updatedItem.description = trimmed;
      } else {
        delete updatedItem.description;
      }
    }

    if (validated.url !== undefined) {
      const trimmed = validated.url.trim();
      if (trimmed) {
        updatedItem.url = trimmed;
      } else {
        delete updatedItem.url;
      }
    }

    if (validated.price !== undefined) {
      updatedItem.price = validated.price;
    }

    if (validated.currency !== undefined) {
      updatedItem.currency = validated.currency.toUpperCase();
    }

    if (validated.priority !== undefined) {
      updatedItem.priority = validated.priority;
    }

    if (validated.isPurchased !== undefined) {
      updatedItem.isPurchased = validated.isPurchased;
    }

    return this.wishlistItemRepository.update(itemId, updatedItem);
  }
}
