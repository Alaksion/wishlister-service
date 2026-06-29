import { Router, type Request } from 'express';
import { RegisterUserUseCase } from '../domains/user/application/register-user.js';
import { LoginUseCase } from '../domains/user/application/login.js';
import { LogoutUseCase } from '../domains/user/application/logout.js';
import { LogoutAllUseCase } from '../domains/user/application/logout-all.js';
import { RefreshUseCase } from '../domains/user/application/refresh.js';
import { createMongoUserRepository } from '../domains/user/infrastructure/user.repository.mongo.js';
import { createMongoRefreshTokenRepository } from '../domains/refresh-token/infrastructure/refresh-token.repository.mongo.js';
import { BadRequestError } from '../shared/errors/app-error.js';

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

function getRefreshTokenFromHeaders(req: Request): string {
  const refreshToken = req.headers['x-refresh-token'];

  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw new BadRequestError('Refresh token is required');
  }

  return refreshToken;
}

export function createAuthRouter(
  dependencies: AuthDependencies = createDefaultDependencies()
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

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new BadRequestError('Email and password are required');
      }

      const tokens = await dependencies.loginUseCase.execute({ email, password });

      res.status(200).json(tokens);
    } catch (error) {
      next(error);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      const refreshToken = getRefreshTokenFromHeaders(req);

      const tokens = await dependencies.refreshUseCase.execute({ refreshToken });

      res.status(200).json(tokens);
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const refreshToken = getRefreshTokenFromHeaders(req);

      await dependencies.logoutUseCase.execute({ refreshToken });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout-all', async (req, res, next) => {
    try {
      const refreshToken = getRefreshTokenFromHeaders(req);

      await dependencies.logoutAllUseCase.execute({ refreshToken });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const authRouter = createAuthRouter();
