import express from 'express';
import { config } from './shared/config/config.js';
import { connectDatabase } from './shared/database/database.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { healthRouter } from './health/health.routes.js';
import { createAuthRouter, type AuthDependencies } from './auth/auth.routes.js';

import { createUsersRouter, type UsersDependencies } from './users/users.routes.js';

export interface AppDependencies {
  authDependencies?: AuthDependencies;
  usersDependencies?: UsersDependencies;
}

export async function createApp(dependencies: AppDependencies = {}) {
  const app = express();

  app.use(express.json());

  app.use('/health', healthRouter);
  app.use('/auth', createAuthRouter(dependencies.authDependencies));
  app.use('/users', createUsersRouter(dependencies.usersDependencies));

  app.use(errorHandler);

  return app;
}

export async function startServer() {
  await connectDatabase();
  const app = await createApp();

  app.listen(config.PORT, () => {
    console.log(`Server running on http://localhost:${config.PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
