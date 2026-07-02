import { ObjectId } from 'mongodb';
import type { UserRepository } from '../../domains/user/application/user.repository.js';
import type { User } from '../../domains/user/domain/user.js';

export class InMemoryUserRepository implements UserRepository {
  private users: User[] = [];

  async findById(id: string): Promise<User | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

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

  async deactivate(id: string): Promise<void> {
    this.users = this.users.map((user) =>
      user.id === id ? { ...user, isActive: false, updatedAt: new Date() } : user
    );
  }

  clear(): void {
    this.users = [];
  }
}

export function createInMemoryUserRepository(): UserRepository {
  return new InMemoryUserRepository();
}
