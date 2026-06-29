import { Router } from 'express';
import multer from 'multer';
import { CreateWishlistItemUseCase } from '../domains/wishlist/application/create-wishlist-item.js';
import { ListWishlistItemsUseCase } from '../domains/wishlist/application/list-wishlist-items.js';
import { createMongoWishlistItemRepository } from '../domains/wishlist/infrastructure/wishlist-item.repository.mongo.js';
import { createAuthMiddleware } from '../shared/middleware/auth-middleware.js';
import { createStorageService } from '../shared/storage/storage-service.js';
import { createMongoUserRepository } from '../domains/user/infrastructure/user.repository.mongo.js';

export interface WishlistDependencies {
  createWishlistItemUseCase: CreateWishlistItemUseCase;
  listWishlistItemsUseCase: ListWishlistItemsUseCase;
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
    listWishlistItemsUseCase: new ListWishlistItemsUseCase(wishlistItemRepository),
    authMiddleware: createAuthMiddleware(userRepository),
  };
}

export function createWishlistRouter(
  dependencies: WishlistDependencies = createDefaultDependencies()
): Router {
  const router = Router();

  router.get('/', dependencies.authMiddleware, async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const result = await dependencies.listWishlistItemsUseCase.execute(
        {
          cursor: req.query.cursor as string | undefined,
          limit: req.query.limit ? Number(req.query.limit) : 20,
          search: req.query.search as string | undefined,
          priority: req.query.priority as 'low' | 'medium' | 'high' | undefined,
          isPurchased: req.query.isPurchased === 'true',
          sortBy:
            (req.query.sortBy as 'createdAt' | 'price' | 'priority' | undefined) ?? 'createdAt',
          sortDirection: (req.query.sortDirection as 'asc' | 'desc' | undefined) ?? 'desc',
        },
        userId
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

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
