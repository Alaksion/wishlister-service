import type { User } from '../domain/user.js';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  create(user: Omit<User, 'id'>): Promise<User>;
}
