export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface RefreshTokenRepository {
  create(refreshToken: Omit<RefreshToken, 'id'>): Promise<RefreshToken>;
  findByTokenHash(token: string): Promise<RefreshToken | null>;
  deleteById(id: string): Promise<void>;
  deleteAllByUserId(userId: string): Promise<void>;
  deleteAllByUserIdExcept(userId: string, excludedToken: string): Promise<void>;
}
