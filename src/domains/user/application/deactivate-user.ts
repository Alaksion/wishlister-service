import type { UserRepository } from './user.repository.js';
import type { RefreshTokenRepository } from '../../refresh-token/application/refresh-token.repository.js';
import type { WishlistItemRepository } from '../../wishlist/application/wishlist-item.repository.js';
import type { StorageService } from '../../../shared/storage/storage-service.js';

export class DeactivateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly wishlistItemRepository: WishlistItemRepository,
    private readonly storageService: StorageService
  ) {}

  async execute(userId: string): Promise<void> {
    const items = await this.wishlistItemRepository.findByUserId(userId);
    const s3Keys = items.flatMap((item) => item.images.map((image) => image.s3Key));

    if (s3Keys.length > 0) {
      await this.storageService.deleteObjects(s3Keys);
    }

    await this.wishlistItemRepository.deleteByUserId(userId);
    await this.refreshTokenRepository.deleteAllByUserId(userId);
    await this.userRepository.deactivate(userId);
  }
}
