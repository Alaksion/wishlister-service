import { Router } from 'express';
import multer from 'multer';
import { CreateWishlistItemUseCase } from '../../domains/wishlist/application/create-wishlist-item.js';
import {
  ListWishlistItemsUseCase,
  listWishlistItemsSchema,
  type ListWishlistItemsInput,
} from '../../domains/wishlist/application/list-wishlist-items.js';
import { GetWishlistItemUseCase } from '../../domains/wishlist/application/get-wishlist-item.js';
import { UpdateWishlistItemUseCase } from '../../domains/wishlist/application/update-wishlist-item.js';
import { DeleteWishlistItemUseCase } from '../../domains/wishlist/application/delete-wishlist-item.js';
import {
  createWishlistItemSchema,
  itemIdParamSchema,
  updateWishlistItemSchema,
} from '../../domains/wishlist/domain/wishlist-item.js';
import { createMongoWishlistItemRepository } from '../../domains/wishlist/infrastructure/wishlist-item.repository.mongo.js';
import {
  createAuthMiddleware,
  getAuthenticatedUser,
} from '../../shared/middleware/auth-middleware.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../../shared/middleware/zod-validation.js';
import { createStorageService } from '../../shared/storage/storage-service.js';
import { createMongoUserRepository } from '../../domains/user/infrastructure/user.repository.mongo.js';

export interface WishlistDependencies {
  createWishlistItemUseCase: CreateWishlistItemUseCase;
  listWishlistItemsUseCase: ListWishlistItemsUseCase;
  getWishlistItemUseCase: GetWishlistItemUseCase;
  updateWishlistItemUseCase: UpdateWishlistItemUseCase;
  deleteWishlistItemUseCase: DeleteWishlistItemUseCase;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
}

const upload = multer({ storage: multer.memoryStorage() });

function createDefaultDependencies(): WishlistDependencies {
  const userRepository = createMongoUserRepository();
  const wishlistItemRepository = createMongoWishlistItemRepository();
  const storageService = createStorageService();
  return {
    createWishlistItemUseCase: new CreateWishlistItemUseCase(
      wishlistItemRepository,
      storageService
    ),
    listWishlistItemsUseCase: new ListWishlistItemsUseCase(wishlistItemRepository),
    getWishlistItemUseCase: new GetWishlistItemUseCase(wishlistItemRepository),
    updateWishlistItemUseCase: new UpdateWishlistItemUseCase(wishlistItemRepository),
    deleteWishlistItemUseCase: new DeleteWishlistItemUseCase(
      wishlistItemRepository,
      storageService
    ),
    authMiddleware: createAuthMiddleware(userRepository),
  };
}

export function createWishlistRouter(
  dependencies: WishlistDependencies = createDefaultDependencies()
): Router {
  const router = Router();

  router.get(
    '/',
    dependencies.authMiddleware,
    validateQuery(listWishlistItemsSchema),
    async (req, res, next) => {
      try {
        const { id: userId } = getAuthenticatedUser(req);

        const result = await dependencies.listWishlistItemsUseCase.execute(
          req.validatedQueries as ListWishlistItemsInput,
          userId
        );

        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/:id',
    dependencies.authMiddleware,
    validateParams(itemIdParamSchema),
    async (req, res, next) => {
      try {
        const { id: userId } = getAuthenticatedUser(req);
        const { id: itemId } = req.params as { id: string };

        const item = await dependencies.getWishlistItemUseCase.execute(itemId, userId);

        res.status(200).json(item);
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    '/:id',
    dependencies.authMiddleware,
    validateParams(itemIdParamSchema),
    validateBody(updateWishlistItemSchema),
    async (req, res, next) => {
      try {
        const { id: userId } = getAuthenticatedUser(req);
        const { id: itemId } = req.params as { id: string };

        const item = await dependencies.updateWishlistItemUseCase.execute(itemId, userId, req.body);

        res.status(200).json(item);
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/:id',
    dependencies.authMiddleware,
    validateParams(itemIdParamSchema),
    async (req, res, next) => {
      try {
        const { id: userId } = getAuthenticatedUser(req);
        const { id: itemId } = req.params as { id: string };

        await dependencies.deleteWishlistItemUseCase.execute(itemId, userId);

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/',
    dependencies.authMiddleware,
    upload.array('images', 3),
    validateBody(createWishlistItemSchema),
    async (req, res, next) => {
      try {
        const { id: userId } = getAuthenticatedUser(req);

        const files = req.files;
        const images = Array.isArray(files)
          ? files.map((file) => ({
              buffer: file.buffer,
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
            }))
          : [];

        const item = await dependencies.createWishlistItemUseCase.execute(req.body, userId, images);

        res.status(201).json(item);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export const wishlistRouter = createWishlistRouter();
