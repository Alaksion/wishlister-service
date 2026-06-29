import type { RefreshTokenRepository } from '../../refresh-token/application/refresh-token.repository.js';
import { UnauthorizedError } from '../../../shared/errors/app-error.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshTokenHash,
} from '../../../shared/tokens/token-service.js';
import type { RefreshInput } from '../domain/user.js';

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export class RefreshUseCase {
  constructor(private readonly refreshTokenRepository: RefreshTokenRepository) {}

  async execute(input: RefreshInput): Promise<RefreshResult> {
    const storedToken = await this.refreshTokenRepository.findByTokenHash(input['x-refresh-token']);

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (storedToken.expiresAt <= new Date()) {
      throw new UnauthorizedError('Refresh token expired');
    }

    const isValid = await verifyRefreshTokenHash(input['x-refresh-token'], storedToken.tokenHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    await this.refreshTokenRepository.deleteById(storedToken.id);

    const newAccessToken = generateAccessToken(storedToken.userId);
    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = await hashRefreshToken(newRefreshToken);

    await this.refreshTokenRepository.create({
      userId: storedToken.userId,
      tokenHash: newRefreshTokenHash,
      expiresAt: storedToken.expiresAt,
      createdAt: new Date(),
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
