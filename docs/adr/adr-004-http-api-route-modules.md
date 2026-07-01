# ADR-004: HTTP API Route Modules Live Under `src/api/`

## Status

Accepted

## Context

Route modules and other HTTP-layer code were originally placed as top-level directories under `src/`: `src/auth/`, `src/users/`, `src/wishlist/`, and `src/health/`. This layout mixed HTTP delivery concerns with the domain layer (`src/domains/`) and made it harder to distinguish adapter code from business logic.

## Decision

Group all HTTP-layer implementation under a single root directory: `src/api/`.

- Express routers live under `src/api/<semantic-name>/`.
- HTTP-specific middleware, request parsing, file upload handling, and status-code mapping belong in this layer.
- Domain logic remains in `src/domains/`.
- Tests stay next to the files they exercise.

Current structure:

```
src/
  api/
    auth/
    users/
    wishlist/
    health/
  domains/
    refresh-token/
    user/
    wishlist/
  shared/
  app.ts
```

## Rationale

- Clear separation between delivery mechanism (HTTP) and business domain.
- Makes room for non-HTTP entry points (e.g., CLI, background jobs) without reorganizing `src/`.
- Router names are semantic and describe their own content rather than being tied 1:1 to domain names.

## Consequences

- New HTTP adapters must be created under `src/api/`.
- Routers may still compose use cases from multiple domains when a single HTTP surface cuts across them.
