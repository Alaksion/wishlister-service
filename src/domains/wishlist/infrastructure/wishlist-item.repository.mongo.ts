import { ObjectId, type Collection, type Filter } from 'mongodb';
import { getDatabase } from '../../../shared/database/database.js';
import type { WishlistItem } from '../domain/wishlist-item.js';
import type {
  ListItemsOptions,
  PaginatedWishlistItems,
  WishlistItemRepository,
} from '../application/wishlist-item.repository.js';

type WishlistItemDocument = Omit<WishlistItem, 'id'> & { _id: ObjectId };

function toWishlistItem(doc: WishlistItemDocument): WishlistItem {
  const item: WishlistItem = {
    id: doc._id.toHexString(),
    userId: doc.userId,
    title: doc.title,
    currency: doc.currency,
    priority: doc.priority,
    isPurchased: doc.isPurchased,
    images: doc.images,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };

  if (doc.description !== undefined) {
    item.description = doc.description;
  }
  if (doc.url !== undefined) {
    item.url = doc.url;
  }
  if (doc.price !== undefined) {
    item.price = doc.price;
  }

  return item;
}

export class MongoWishlistItemRepository implements WishlistItemRepository {
  private get collection(): Collection<Omit<WishlistItem, 'id'>> {
    return getDatabase().collection<Omit<WishlistItem, 'id'>>('wishlistItems');
  }

  async create(item: Omit<WishlistItem, 'id'>): Promise<WishlistItem> {
    const result = await this.collection.insertOne(item);
    return {
      ...item,
      id: result.insertedId.toHexString(),
    };
  }

  async findByUserId(userId: string): Promise<WishlistItem[]> {
    const docs = (await this.collection.find({ userId }).toArray()) as WishlistItemDocument[];
    return docs.map(toWishlistItem);
  }

  async list(options: ListItemsOptions): Promise<PaginatedWishlistItems> {
    const filter: Filter<Omit<WishlistItem, 'id'>> = { userId: options.userId };

    if (options.priority) {
      filter.priority = options.priority;
    }

    if (options.isPurchased !== undefined) {
      filter.isPurchased = options.isPurchased;
    }

    if (options.search) {
      filter.$text = { $search: options.search };
    }

    if (options.cursor) {
      filter.$or = [
        { createdAt: { $lt: options.cursor.createdAt } },
        {
          createdAt: options.cursor.createdAt,
          _id: { $lt: new ObjectId(options.cursor.id) },
        },
      ];
    }

    const sortDirection = options.sortDirection === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> =
      options.sortBy === 'createdAt'
        ? { createdAt: sortDirection, _id: sortDirection }
        : { [options.sortBy]: sortDirection, _id: sortDirection };

    const docs = (await this.collection
      .find(filter)
      .sort(sort)
      .limit(options.limit + 1)
      .toArray()) as WishlistItemDocument[];

    const hasMore = docs.length > options.limit;
    const pageDocs = hasMore ? docs.slice(0, -1) : docs;

    return {
      items: pageDocs.map(toWishlistItem),
      nextCursor: hasMore
        ? {
            createdAt: pageDocs[pageDocs.length - 1]!.createdAt,
            id: pageDocs[pageDocs.length - 1]!._id.toHexString(),
          }
        : null,
    };
  }

  async findById(id: string): Promise<WishlistItem | null> {
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return null;
    }

    const doc = (await this.collection.findOne({ _id: objectId })) as WishlistItemDocument | null;
    return doc ? toWishlistItem(doc) : null;
  }

  async update(id: string, item: WishlistItem): Promise<WishlistItem> {
    const objectId = new ObjectId(id);
    const { id: _itemId, ...itemWithoutId } = item;
    void _itemId;
    await this.collection.replaceOne({ _id: objectId }, itemWithoutId);
    return item;
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.collection.deleteMany({ userId });
  }
}

export function createMongoWishlistItemRepository(): WishlistItemRepository {
  return new MongoWishlistItemRepository();
}
