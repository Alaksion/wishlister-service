import { compareRefreshTokenHash } from '../../shared/tokens/token-service.js';
import { ObjectId } from 'mongodb';
import type {
  RefreshToken,
  RefreshTokenRepository,
} from '../../domains/refresh-token/application/refresh-token.repository.js';

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
    for (const token of this.refreshTokens) {
      const matches = await compareRefreshTokenHash(tokenHash, token.tokenHash);
      if (matches) {
        return token;
      }
    }
    return null;
  }

  async deleteById(id: string): Promise<void> {
    this.refreshTokens = this.refreshTokens.filter((token) => token.id !== id);
  }

  async deleteAllByUserId(userId: string): Promise<void> {
    this.refreshTokens = this.refreshTokens.filter((token) => token.userId !== userId);
  }

  async deleteAllByUserIdExcept(userId: string, excludedToken: string): Promise<void> {
    const keptTokens: RefreshToken[] = [];
    for (const token of this.refreshTokens) {
      const isExcluded = await compareRefreshTokenHash(excludedToken, token.tokenHash);
      if (token.userId !== userId || isExcluded) {
        keptTokens.push(token);
      }
    }
    this.refreshTokens = keptTokens;
  }

  clear(): void {
    this.refreshTokens = [];
  }
}

export function createInMemoryRefreshTokenRepository(): RefreshTokenRepository {
  return new InMemoryRefreshTokenRepository();
}
