import { ObjectId, type Collection } from 'mongodb';
import { getDatabase } from '../../../shared/database/database.js';
import type { UserRepository } from '../application/user.repository.js';
import type { User } from '../domain/user.js';

type UserDocument = Omit<User, 'id'> & { _id: ObjectId };

function toUser(doc: UserDocument): User {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    displayName: doc.displayName,
    passwordHash: doc.passwordHash,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoUserRepository implements UserRepository {
  private get collection(): Collection<Omit<User, 'id'>> {
    return getDatabase().collection<Omit<User, 'id'>>('users');
  }

  async findById(id: string): Promise<User | null> {
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return null;
    }

    const doc = (await this.collection.findOne({ _id: objectId })) as UserDocument | null;
    return doc ? toUser(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = (await this.collection.findOne({
      email: email.toLowerCase(),
      isActive: true,
    })) as UserDocument | null;

    return doc ? toUser(doc) : null;
  }

  async create(user: Omit<User, 'id'>): Promise<User> {
    const result = await this.collection.insertOne(user);

    return {
      ...user,
      id: result.insertedId.toHexString(),
    };
  }
}

export function createMongoUserRepository(): UserRepository {
  return new MongoUserRepository();
}
