import { Router } from 'express';
import { DeactivateUserUseCase } from '../../domains/user/application/deactivate-user.js';
import { createMongoUserRepository } from '../../domains/user/infrastructure/user.repository.mongo.js';
import { createMongoRefreshTokenRepository } from '../../domains/refresh-token/infrastructure/refresh-token.repository.mongo.js';
import { createMongoWishlistItemRepository } from '../../domains/wishlist/infrastructure/wishlist-item.repository.mongo.js';
import { createAuthMiddleware } from '../../shared/middleware/auth-middleware.js';
import { createStorageService } from '../../shared/storage/storage-service.js';

export interface UsersDependencies {
  deactivateUserUseCase: DeactivateUserUseCase;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
}

function createDefaultDependencies(): UsersDependencies {
  const userRepository = createMongoUserRepository();
  return {
    deactivateUserUseCase: new DeactivateUserUseCase(
      userRepository,
      createMongoRefreshTokenRepository(),
      createMongoWishlistItemRepository(),
      createStorageService()
    ),
    authMiddleware: createAuthMiddleware(userRepository),
  };
}

export function createUsersRouter(
  dependencies: UsersDependencies = createDefaultDependencies()
): Router {
  const router = Router();

  router.delete('/me', dependencies.authMiddleware, async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      await dependencies.deactivateUserUseCase.execute(userId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const usersRouter = createUsersRouter();
