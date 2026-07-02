import crypto from 'crypto';
import sharp from 'sharp';
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

interface StagedImage {
  stagingKey: string;
  finalKey: string;
  originalName: string;
  mimetype: string;
  compressedBuffer: Buffer;
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

    const itemId = crypto.randomUUID();
    const stagedImages: StagedImage[] = [];

    for (const image of images) {
      this.validateImage(image);
      const compressedBuffer = await this.compressImage(image.buffer, image.mimetype);
      const { stagingKey, finalKey } = this.generateImageKeys(userId, itemId, image.originalname);

      await this.storageService.uploadObject(stagingKey, compressedBuffer, image.mimetype);

      stagedImages.push({
        stagingKey,
        finalKey,
        originalName: image.originalname,
        mimetype: image.mimetype,
        compressedBuffer,
      });
    }

    const processedImages: Image[] = stagedImages.map((stagedImage) => ({
      s3Key: stagedImage.finalKey,
      url: this.storageService.getObjectUrl(stagedImage.finalKey),
      originalName: stagedImage.originalName,
      uploadedAt: new Date(),
    }));

    const itemToCreate = createWishlistItem(validated, userId, processedImages, itemId);
    let createdItem = await this.wishlistItemRepository.create(itemToCreate);

    for (let i = 0; i < stagedImages.length; i++) {
      const stagedImage = stagedImages[i]!;
      try {
        const movedObject = await this.storageService.moveObject(
          stagedImage.stagingKey,
          stagedImage.finalKey
        );
        createdItem.images[i] = {
          ...createdItem.images[i]!,
          s3Key: movedObject.key,
          url: movedObject.url,
        };
      } catch (error) {
        console.error(
          `Failed to move staged object ${stagedImage.stagingKey} to ${stagedImage.finalKey} for item ${itemId}:`,
          error
        );
        createdItem.images[i] = {
          ...createdItem.images[i]!,
          s3Key: stagedImage.stagingKey,
          url: this.storageService.getObjectUrl(stagedImage.stagingKey),
        };
      }
    }

    if (stagedImages.length > 0) {
      createdItem = await this.wishlistItemRepository.update(createdItem.id, createdItem);
    }

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
        return sharpInstance.png({ quality: 85, palette: true, compressionLevel: 8 }).toBuffer();
      case 'image/webp':
        return sharpInstance.webp({ quality: 85 }).toBuffer();
      default:
        return buffer;
    }
  }

  private generateImageKeys(
    userId: string,
    itemId: string,
    originalName: string
  ): { stagingKey: string; finalKey: string } {
    const extension = originalName.split('.').pop() ?? 'bin';
    const randomName = `${crypto.randomUUID()}.${extension}`;
    const stagingKey = `staging/${userId}/${itemId}/${randomName}`;
    const finalKey = `${userId}/${itemId}/${randomName}`;
    return { stagingKey, finalKey };
  }
}
