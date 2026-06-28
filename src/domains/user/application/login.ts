import bcrypt from 'bcrypt';
import { z } from 'zod';
import type { UserRepository } from './user.repository.js';
import { UnauthorizedError } from '../../../shared/errors/app-error.js';
import { normalizeEmail } from '../domain/user.js';
import type { RefreshTokenRepository } from '../../refresh-token/application/refresh-token.repository.js';
import { generateAuthTokens, hashRefreshToken } from '../../../shared/tokens/token-service.js';

export const loginSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const validated = loginSchema.parse(input);
    const normalizedEmail = normalizeEmail(validated.email);

    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(validated.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const tokens = generateAuthTokens(user.id);
    const tokenHash = await hashRefreshToken(tokens.refreshToken);

    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt: tokens.refreshTokenExpiresAt,
      createdAt: new Date(),
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }
}
