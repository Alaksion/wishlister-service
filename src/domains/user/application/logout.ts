import { z } from 'zod';
import type { RefreshTokenRepository } from '../../refresh-token/application/refresh-token.repository.js';
import { UnauthorizedError } from '../../../shared/errors/app-error.js';
import { verifyRefreshTokenHash } from '../../../shared/tokens/token-service.js';

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LogoutInput = z.infer<typeof logoutSchema>;

export class LogoutUseCase {
  constructor(private readonly refreshTokenRepository: RefreshTokenRepository) {}

  async execute(input: LogoutInput): Promise<void> {
    const validated = logoutSchema.parse(input);

    const storedToken = await this.refreshTokenRepository.findByTokenHash(validated.refreshToken);

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const isValid = await verifyRefreshTokenHash(validated.refreshToken, storedToken.tokenHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    await this.refreshTokenRepository.deleteById(storedToken.id);
  }
}
