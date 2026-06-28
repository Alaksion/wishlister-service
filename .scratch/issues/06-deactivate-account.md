## What to build

Implement account deactivation. `DELETE /users/me` soft-deletes the authenticated user by setting `isActive` to false. As a consequence, all refresh tokens for that user are revoked and all wishlist items (and their associated S3 objects) are permanently deleted.

This action is irreversible: reactivation does not restore deleted items.

## Acceptance criteria

- [ ] `DELETE /users/me` marks the authenticated user as inactive.
- [ ] All refresh tokens for the user are deleted.
- [ ] All wishlist items belonging to the user are permanently deleted.
- [ ] All S3 objects referenced by the user's items are deleted using stored `s3Key`s.
- [ ] Subsequent requests with the user's access token return 401.

## Blocked by

- #4 Authenticated requests and logout
