import { createApp } from './app.js';

export async function startServer() {
  const app = await createApp();
  const PORT = process.env.PORT ?? 3000;

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
