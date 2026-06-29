import { z } from 'zod';
import type { RefreshTokenRepository } from '../../refresh-token/application/refresh-token.repository.js';
import { UnauthorizedError } from '../../../shared/errors/app-error.js';
import { verifyRefreshTokenHash } from '../../../shared/tokens/token-service.js';

export const logoutAllSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LogoutAllInput = z.infer<typeof logoutAllSchema>;

export class LogoutAllUseCase {
  constructor(private readonly refreshTokenRepository: RefreshTokenRepository) {}

  async execute(input: LogoutAllInput): Promise<void> {
    const validated = logoutAllSchema.parse(input);

    const storedToken = await this.refreshTokenRepository.findByTokenHash(validated.refreshToken);

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const isValid = await verifyRefreshTokenHash(validated.refreshToken, storedToken.tokenHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    await this.refreshTokenRepository.deleteAllByUserIdExcept(
      storedToken.userId,
      validated.refreshToken
    );
  }
}
