import crypto from 'crypto';
import sharp from 'sharp';
import { z } from 'zod';
import type { WishlistItemRepository } from '../application/wishlist-item.repository.js';
import type { StorageService } from '../../../shared/storage/storage-service.js';
import {
  type CreateWishlistItemInput,
  type Image,
  createWishlistItem,
  createWishlistItemSchema,
} from '../domain/wishlist-item.js';
import { BadRequestError } from '../../../shared/errors/app-error.js';

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ImageFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export const createWishlistItemSchemaInput = createWishlistItemSchema.extend({
  images: z.array(z.any()).max(MAX_IMAGES, `Maximum ${MAX_IMAGES} images allowed`).default([]),
});

export interface CreateWishlistItemUseCaseResult {
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

export class CreateWishlistItemUseCase {
  constructor(
    private readonly wishlistItemRepository: WishlistItemRepository,
    private readonly storageService: StorageService
  ) {}

  async execute(
    input: CreateWishlistItemInput,
    userId: string,
    images: ImageFile[] = []
  ): Promise<CreateWishlistItemUseCaseResult> {
    const validated = createWishlistItemSchema.parse(input);

    if (images.length > MAX_IMAGES) {
      throw new BadRequestError(`Maximum ${MAX_IMAGES} images allowed`);
    }

    const processedImages: Image[] = [];

    for (const image of images) {
      this.validateImage(image);
      const processedBuffer = await this.compressImage(image.buffer, image.mimetype);
      const s3Key = this.generateS3Key(userId, image.originalname);
      const uploaded = await this.storageService.uploadObject(
        s3Key,
        processedBuffer,
        image.mimetype
      );

      processedImages.push({
        s3Key: uploaded.key,
        url: uploaded.url,
        originalName: image.originalname,
        uploadedAt: new Date(),
      });
    }

    const itemToCreate = createWishlistItem(validated, userId, processedImages);
    const createdItem = await this.wishlistItemRepository.create(itemToCreate);

    return createdItem;
  }

  private validateImage(image: ImageFile): void {
    if (!ALLOWED_MIME_TYPES.includes(image.mimetype)) {
      throw new BadRequestError(
        `Invalid image type: ${image.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      );
    }

    if (image.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestError('Image exceeds maximum size of 5 MB');
    }
  }

  private async compressImage(buffer: Buffer, mimetype: string): Promise<Buffer> {
    const sharpInstance = sharp(buffer);

    switch (mimetype) {
      case 'image/jpeg':
        return sharpInstance.jpeg({ quality: 85, progressive: true }).toBuffer();
      case 'image/png':
        return sharpInstance.png({ quality: 85, compressionLevel: 8 }).toBuffer();
      case 'image/webp':
        return sharpInstance.webp({ quality: 85 }).toBuffer();
      default:
        return buffer;
    }
  }

  private generateS3Key(userId: string, originalName: string): string {
    const extension = originalName.split('.').pop() ?? 'bin';
    const randomId = crypto.randomBytes(16).toString('hex');
    return `users/${userId}/images/${randomId}.${extension}`;
  }
}
