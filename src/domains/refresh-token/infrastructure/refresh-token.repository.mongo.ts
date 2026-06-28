import { ObjectId, type Collection } from 'mongodb';
import { getDatabase } from '../../../shared/database/database.js';
import { verifyRefreshTokenHash } from '../../../shared/tokens/token-service.js';
import type {
  RefreshToken,
  RefreshTokenRepository,
} from '../application/refresh-token.repository.js';

type RefreshTokenDocument = Omit<RefreshToken, 'id'> & { _id: ObjectId };

function toRefreshToken(doc: RefreshTokenDocument): RefreshToken {
  return {
    id: doc._id.toHexString(),
    userId: doc.userId,
    tokenHash: doc.tokenHash,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
  };
}

export class MongoRefreshTokenRepository implements RefreshTokenRepository {
  private get collection(): Collection<Omit<RefreshToken, 'id'>> {
    return getDatabase().collection<Omit<RefreshToken, 'id'>>('refreshTokens');
  }

  async create(refreshToken: Omit<RefreshToken, 'id'>): Promise<RefreshToken> {
    const result = await this.collection.insertOne(refreshToken);
    return {
      ...refreshToken,
      id: result.insertedId.toHexString(),
    };
  }

  async findByTokenHash(token: string): Promise<RefreshToken | null> {
    const docs = (await this.collection
      .find({
        expiresAt: { $gt: new Date() },
      })
      .toArray()) as RefreshTokenDocument[];

    for (const doc of docs) {
      const matches = await verifyRefreshTokenHash(token, doc.tokenHash);
      if (matches) {
        return toRefreshToken(doc);
      }
    }

    return null;
  }

  async deleteById(id: string): Promise<void> {
    await this.collection.deleteOne({ _id: new ObjectId(id) });
  }

  async deleteAllByUserId(userId: string): Promise<void> {
    await this.collection.deleteMany({ userId });
  }

  async deleteAllByUserIdExcept(userId: string, excludedTokenHash: string): Promise<void> {
    await this.collection.deleteMany({
      userId,
      tokenHash: { $ne: excludedTokenHash },
    });
  }
}

export function createMongoRefreshTokenRepository(): RefreshTokenRepository {
  return new MongoRefreshTokenRepository();
}
