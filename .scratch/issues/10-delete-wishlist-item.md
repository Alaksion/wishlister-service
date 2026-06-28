## What to build

Implement wishlist item deletion. `DELETE /items/:id` hard-deletes the item if it belongs to the authenticated user, and deletes all associated S3 objects using the stored `s3Key`s to prevent orphan objects.

Users can only delete their own items. Attempting to delete another user's item returns 404.

## Acceptance criteria

- [ ] `DELETE /items/:id` deletes the item if owned by the authenticated user.
- [ ] All S3 objects referenced by the item are deleted.
- [ ] Deleting another user's item returns 404.
- [ ] Returns 204 on successful deletion.

## Blocked by

- #7 Create wishlist item with image upload
