import {
  type PublicUser,
  type RegisterUserInput,
  createUser,
  hashPassword,
  normalizeEmail,
  registerUserSchema,
} from '../domain/user.js';
import type { UserRepository } from './user.repository.js';
import { ConflictError } from '../../../shared/errors/app-error.js';

export class RegisterUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: RegisterUserInput): Promise<PublicUser> {
    const validated = registerUserSchema.parse(input);
    const normalizedEmail = normalizeEmail(validated.email);

    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await hashPassword(validated.password);
    const userToCreate = createUser(validated, passwordHash);

    const createdUser = await this.userRepository.create(userToCreate);

    return {
      id: createdUser.id,
      email: createdUser.email,
      displayName: createdUser.displayName,
    };
  }
}
