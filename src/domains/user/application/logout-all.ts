import type { RefreshTokenRepository } from '../../refresh-token/application/refresh-token.repository.js';
import { UnauthorizedError } from '../../../shared/errors/app-error.js';
import { verifyRefreshTokenHash } from '../../../shared/tokens/token-service.js';
import type { LogoutInput } from '../domain/user.js';

export type LogoutAllInput = LogoutInput;

export class LogoutAllUseCase {
  constructor(private readonly refreshTokenRepository: RefreshTokenRepository) {}

  async execute(input: LogoutAllInput): Promise<void> {
    const storedToken = await this.refreshTokenRepository.findByTokenHash(input.refreshToken);

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const isValid = await verifyRefreshTokenHash(input.refreshToken, storedToken.tokenHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    await this.refreshTokenRepository.deleteAllByUserIdExcept(
      storedToken.userId,
      input.refreshToken
    );
  }
}
