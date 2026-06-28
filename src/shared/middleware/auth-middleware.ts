import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { verifyAccessToken } from '../tokens/token-service.js';
import type { UserRepository } from '../../domains/user/application/user.repository.js';
import type { User } from '../../domains/user/domain/user.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

export function createAuthMiddleware(userRepository: UserRepository) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing or invalid authorization header');
      }

      const token = authHeader.slice(7);

      const payload = verifyAccessToken(token);

      const user = await userRepository.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedError('User account is inactive or no longer exists');
      }

      req.user = user;
      next();
    } catch {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  };
}
