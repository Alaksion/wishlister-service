import { ObjectId } from 'mongodb';
import type { UserRepository } from '../application/user.repository.js';
import type { User } from '../domain/user.js';

export class InMemoryUserRepository implements UserRepository {
  private users: User[] = [];

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((user) => user.email === email.toLowerCase() && user.isActive) ?? null;
  }

  async create(user: Omit<User, 'id'>): Promise<User> {
    const created: User = {
      ...user,
      id: new ObjectId().toHexString(),
    };
    this.users.push(created);
    return created;
  }

  clear(): void {
    this.users = [];
  }
}

export function createInMemoryUserRepository(): UserRepository {
  return new InMemoryUserRepository();
}
