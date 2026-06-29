import { ObjectId, type Collection } from 'mongodb';
import { getDatabase } from '../../../shared/database/database.js';
import type { WishlistItem } from '../domain/wishlist-item.js';
import type { WishlistItemRepository } from '../application/wishlist-item.repository.js';

type WishlistItemDocument = Omit<WishlistItem, 'id'> & { _id: ObjectId };

function toWishlistItem(doc: WishlistItemDocument): WishlistItem {
  return {
    id: doc._id.toHexString(),
    userId: doc.userId,
    title: doc.title,
    currency: doc.currency,
    priority: doc.priority,
    isPurchased: doc.isPurchased,
    images: doc.images,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...(doc.description !== undefined ? { description: doc.description } : {}),
    ...(doc.url !== undefined ? { url: doc.url } : {}),
    ...(doc.price !== undefined ? { price: doc.price } : {}),
  };
}

export class MongoWishlistItemRepository implements WishlistItemRepository {
  private get collection(): Collection<Omit<WishlistItem, 'id'>> {
    return getDatabase().collection<Omit<WishlistItem, 'id'>>('wishlistItems');
  }

  async findByUserId(userId: string): Promise<WishlistItem[]> {
    const docs = (await this.collection.find({ userId }).toArray()) as WishlistItemDocument[];
    return docs.map(toWishlistItem);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.collection.deleteMany({ userId });
  }
}

export function createMongoWishlistItemRepository(): WishlistItemRepository {
  return new MongoWishlistItemRepository();
}
