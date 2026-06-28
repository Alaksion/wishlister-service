## What to build

Implement user login. A registered user can exchange a valid email and password for a short-lived access token and a long-lived refresh token. The access token expires in 15 minutes and contains the user id. The refresh token expires in 7 days and is persisted as a hash in the database so it can be revoked later.

Return both tokens on success. Invalid credentials should return a generic 401 without distinguishing between unknown email and wrong password.

## Acceptance criteria

- [ ] `POST /auth/login` accepts `email` and `password`.
- [ ] On valid credentials, returns an access token (15-minute expiry) and a refresh token (7-day expiry).
- [ ] A hash of the refresh token is stored in MongoDB with the user id and expiry.
- [ ] Invalid credentials return 401 with no leakage of which field was wrong.
- [ ] Tokens include only the user id and standard JWT claims.

## Blocked by

- #2 Register user account
