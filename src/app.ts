import express from 'express';
import { config } from './shared/config/config.js';
import { connectDatabase } from './shared/database/database.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { healthRouter } from './health/health.routes.js';

export async function createApp() {
  const app = express();

  app.use(express.json());

  app.use('/health', healthRouter);

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
