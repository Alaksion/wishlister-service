## What to build

Set up the technical foundation for the wishlister backend so that all subsequent feature slices have a stable base. This slice should wire up the Express application, configure environment-based settings, connect to MongoDB (AWS DocumentDB), and establish a minimal health-check endpoint and global error-handling shape.

The result must be runnable locally and in production: `npm run dev` starts the server and responds to a health endpoint, database connection is validated on boot, and unexpected errors are caught and returned as JSON without leaking stack traces.

## Acceptance criteria

- [ ] Express app boots and exposes a `GET /health` endpoint that returns 200 OK.
- [ ] MongoDB connection is configured and verified on application startup.
- [ ] Environment configuration is centralized (port, database URI, JWT secrets, S3 credentials).
- [ ] A global error handler catches unhandled errors and returns a consistent JSON error shape.
- [ ] `npm run build` and `npm run lint` pass.

## Blocked by

None - can start immediately.
