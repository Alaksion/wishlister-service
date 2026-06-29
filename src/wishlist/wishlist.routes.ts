import { Router } from 'express';
import multer from 'multer';
import { CreateWishlistItemUseCase } from '../domains/wishlist/application/create-wishlist-item.js';
import { createMongoWishlistItemRepository } from '../domains/wishlist/infrastructure/wishlist-item.repository.mongo.js';
import { createAuthMiddleware } from '../shared/middleware/auth-middleware.js';
import { createStorageService } from '../shared/storage/storage-service.js';
import { createMongoUserRepository } from '../domains/user/infrastructure/user.repository.mongo.js';

export interface WishlistDependencies {
  createWishlistItemUseCase: CreateWishlistItemUseCase;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
}

const upload = multer({ storage: multer.memoryStorage() });

function createDefaultDependencies(): WishlistDependencies {
  const userRepository = createMongoUserRepository();
  const wishlistItemRepository = createMongoWishlistItemRepository();
  return {
    createWishlistItemUseCase: new CreateWishlistItemUseCase(
      wishlistItemRepository,
      createStorageService()
    ),
    authMiddleware: createAuthMiddleware(userRepository),
  };
}

export function createWishlistRouter(
  dependencies: WishlistDependencies = createDefaultDependencies()
): Router {
  const router = Router();

  router.post(
    '/',
    dependencies.authMiddleware,
    upload.array('images', 3),
    async (req, res, next) => {
      try {
        const userId = req.user?.id;

        if (!userId) {
          res.status(401).json({ error: { message: 'Unauthorized' } });
          return;
        }

        const files = req.files;
        const images = Array.isArray(files)
          ? files.map((file) => ({
              buffer: file.buffer,
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
            }))
          : [];

        const item = await dependencies.createWishlistItemUseCase.execute(
          {
            title: req.body.title,
            description: req.body.description,
            url: req.body.url,
            price: req.body.price,
            currency: req.body.currency,
            priority: req.body.priority,
          },
          userId,
          images
        );

        res.status(201).json(item);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export const wishlistRouter = createWishlistRouter();
