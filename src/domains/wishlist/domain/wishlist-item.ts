import { z } from 'zod';

export interface Image {
  s3Key: string;
  url: string;
  originalName?: string;
  uploadedAt: Date;
}

export interface WishlistItem {
  id: string;
  userId: string;
  title: string;
  description?: string;
  url?: string;
  price?: number;
  currency: string;
  priority: 'low' | 'medium' | 'high';
  isPurchased: boolean;
  images: Image[];
  createdAt: Date;
  updatedAt: Date;
}

export const prioritySchema = z.enum(['low', 'medium', 'high']);

export const itemIdParamSchema = z.object({
  id: z.string().min(1, 'Item id is required'),
});

export type ItemIdParamInput = z.infer<typeof itemIdParamSchema>;

export const createWishlistItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: z.string().max(2000, 'Description must be 2000 characters or less').optional(),
  url: z.string().url('Invalid URL format').optional().or(z.literal('')),
  price: z.coerce
    .number()
    .int('Price must be an integer')
    .nonnegative('Price cannot be negative')
    .optional(),
  currency: z.string().min(3).max(3).default('USD'),
  priority: prioritySchema.default('medium'),
});

export type CreateWishlistItemInput = z.infer<typeof createWishlistItemSchema>;

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

export function createWishlistItem(
  id: string,
  input: CreateWishlistItemInput,
  userId: string,
  images: Image[]
): WishlistItem {
  const now = new Date();
  const item: WishlistItem = {
    id,
    userId,
    title: input.title.trim(),
    currency: input.currency.toUpperCase(),
    priority: input.priority,
    isPurchased: false,
    images,
    createdAt: now,
    updatedAt: now,
  };

  const description = input.description?.trim();
  if (description) {
    item.description = description;
  }

  const url = input.url?.trim();
  if (url) {
    item.url = url;
  }

  if (input.price !== undefined) {
    item.price = input.price;
  }

  return item;
}

export type PublicWishlistItem = WishlistItem;

export function toPublicWishlistItem(item: WishlistItem): PublicWishlistItem {
  return item;
}
