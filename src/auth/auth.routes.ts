import { Router } from 'express';
import { RegisterUserUseCase } from '../domains/user/application/register-user.js';
import { createMongoUserRepository } from '../domains/user/infrastructure/user.repository.mongo.js';
import { BadRequestError } from '../shared/errors/app-error.js';

export interface AuthDependencies {
  registerUserUseCase: RegisterUserUseCase;
}

export function createAuthRouter(
  dependencies: AuthDependencies = {
    registerUserUseCase: new RegisterUserUseCase(createMongoUserRepository()),
  }
): Router {
  const router = Router();

  router.post('/register', async (req, res, next) => {
    try {
      const { email, displayName, password } = req.body;

      if (!email || !displayName || !password) {
        throw new BadRequestError('Email, displayName, and password are required');
      }

      const user = await dependencies.registerUserUseCase.execute({
        email,
        displayName,
        password,
      });

      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const authRouter = createAuthRouter();
