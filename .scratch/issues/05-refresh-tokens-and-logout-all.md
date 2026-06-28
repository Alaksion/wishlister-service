## What to build

Implement token rotation and multi-device session control. `POST /auth/refresh` accepts a valid refresh token and returns a new access token. The refresh token itself may optionally be rotated (new token issued, old hash deleted).

`POST /auth/logout-all` revokes every refresh token belonging to the authenticated user except the one currently in use by the request. This enables "log out other devices".

## Acceptance criteria

- [ ] `POST /auth/refresh` returns a new access token when given a valid, unexpired refresh token.
- [ ] Used/expired refresh tokens are rejected with 401.
- [ ] `POST /auth/logout-all` deletes all refresh tokens for the user except the current one.
- [ ] Both endpoints require a valid refresh token in the request headers.

## Blocked by

- #3 Log in and issue JWT tokens
- #4 Authenticated requests and logout
