## What to build

Implement retrieving and partially updating a wishlist item. `GET /items/:id` returns the item if it belongs to the authenticated user. `PATCH /items/:id` supports partial updates including toggling `isPurchased` on and off.

Users can only access items they created. Attempting to access another user's item returns 404 (not 403) to avoid leaking existence.

## Acceptance criteria

- [ ] `GET /items/:id` returns the item if owned by the authenticated user.
- [ ] `PATCH /items/:id` supports partial updates of allowed fields.
- [ ] `isPurchased` can be toggled freely.
- [ ] Accessing another user's item returns 404.
- [ ] `createdAt` and `updatedAt` are exposed in responses.

## Blocked by

- #7 Create wishlist item with image upload
