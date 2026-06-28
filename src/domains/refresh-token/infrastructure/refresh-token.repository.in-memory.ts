import { ObjectId } from 'mongodb';
import type {
  RefreshToken,
  RefreshTokenRepository,
} from '../application/refresh-token.repository.js';

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private refreshTokens: RefreshToken[] = [];

  async create(refreshToken: Omit<RefreshToken, 'id'>): Promise<RefreshToken> {
    const created: RefreshToken = {
      ...refreshToken,
      id: new ObjectId().toHexString(),
    };
    this.refreshTokens.push(created);
    return created;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.refreshTokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async deleteById(id: string): Promise<void> {
    this.refreshTokens = this.refreshTokens.filter((token) => token.id !== id);
  }

  async deleteAllByUserId(userId: string): Promise<void> {
    this.refreshTokens = this.refreshTokens.filter((token) => token.userId !== userId);
  }

  async deleteAllByUserIdExcept(userId: string, excludedTokenHash: string): Promise<void> {
    this.refreshTokens = this.refreshTokens.filter(
      (token) => token.userId !== userId || token.tokenHash === excludedTokenHash
    );
  }

  clear(): void {
    this.refreshTokens = [];
  }
}

export function createInMemoryRefreshTokenRepository(): RefreshTokenRepository {
  return new InMemoryRefreshTokenRepository();
}
