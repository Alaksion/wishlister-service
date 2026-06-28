## What to build

Add authentication middleware that validates the access token on protected routes and confirms the user account is still active. If the token is missing, expired, or the account has been deactivated, the request is rejected with 401.

Also add `POST /auth/logout`, which revokes the refresh token presented in the request headers by deleting it from the database.

## Acceptance criteria

- [ ] Middleware extracts and verifies the JWT access token from the `Authorization` header.
- [ ] Middleware checks the user's `isActive` flag on every request.
- [ ] Deactivated users are rejected immediately, even with an unexpired token.
- [ ] `POST /auth/logout` deletes the current refresh token from the database.
- [ ] Logout returns 204 on success and 401 if the refresh token is invalid.

## Blocked by

- #3 Log in and issue JWT tokens
