import { z } from 'zod';
import { Router } from 'express';
import { RegisterUserUseCase } from '../../domains/user/application/register-user.js';
import { LoginUseCase } from '../../domains/user/application/login.js';
import { LogoutUseCase } from '../../domains/user/application/logout.js';
import { LogoutAllUseCase } from '../../domains/user/application/logout-all.js';
import { RefreshUseCase } from '../../domains/user/application/refresh.js';
import { createMongoUserRepository } from '../../domains/user/infrastructure/user.repository.mongo.js';
import { createMongoRefreshTokenRepository } from '../../domains/refresh-token/infrastructure/refresh-token.repository.mongo.js';
import { loginSchema, registerUserSchema } from '../../domains/user/domain/user.js';
import { validateBody, validateHeader } from '../../shared/middleware/zod-validation.js';

export interface AuthDependencies {
  registerUserUseCase: RegisterUserUseCase;
  loginUseCase: LoginUseCase;
  logoutUseCase: LogoutUseCase;
  logoutAllUseCase: LogoutAllUseCase;
  refreshUseCase: RefreshUseCase;
}

function createDefaultDependencies(): AuthDependencies {
  const userRepository = createMongoUserRepository();
  const refreshTokenRepository = createMongoRefreshTokenRepository();
  return {
    registerUserUseCase: new RegisterUserUseCase(userRepository),
    loginUseCase: new LoginUseCase(userRepository, refreshTokenRepository),
    logoutUseCase: new LogoutUseCase(refreshTokenRepository),
    logoutAllUseCase: new LogoutAllUseCase(refreshTokenRepository),
    refreshUseCase: new RefreshUseCase(refreshTokenRepository),
  };
}

const refreshTokenHeaderSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export function createAuthRouter(
  dependencies: AuthDependencies = createDefaultDependencies()
): Router {
  const router = Router();

  router.post('/register', validateBody(registerUserSchema), async (req, res, next) => {
    try {
      const { email, displayName, password } = req.body;

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

  router.post('/login', validateBody(loginSchema), async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const tokens = await dependencies.loginUseCase.execute({ email, password });

      res.status(200).json(tokens);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/refresh',
    validateHeader(refreshTokenHeaderSchema, 'x-refresh-token'),
    async (req, res, next) => {
      try {
        const refreshToken = req.headers['x-refresh-token'] as string;

        const tokens = await dependencies.refreshUseCase.execute({ refreshToken });

        res.status(200).json(tokens);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/logout',
    validateHeader(refreshTokenHeaderSchema, 'x-refresh-token'),
    async (req, res, next) => {
      try {
        const refreshToken = req.headers['x-refresh-token'] as string;

        await dependencies.logoutUseCase.execute({ refreshToken });

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/logout-all',
    validateHeader(refreshTokenHeaderSchema, 'x-refresh-token'),
    async (req, res, next) => {
      try {
        const refreshToken = req.headers['x-refresh-token'] as string;

        await dependencies.logoutAllUseCase.execute({ refreshToken });

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export const authRouter = createAuthRouter();
