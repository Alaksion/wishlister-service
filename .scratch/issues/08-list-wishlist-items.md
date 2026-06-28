## What to build

Implement listing of wishlist items for the authenticated user. `GET /items` returns only the current user's items with cursor-based pagination (default page size 20, encoded opaque cursor), filtering, and sorting.

Supported filters: text search on `title` and `description`, `priority`, and `isPurchased`. Supported sort fields: `createdAt`, `price`, `priority`. Default sort is newest first (`createdAt` descending).

## Acceptance criteria

- [ ] `GET /items` returns only items belonging to the authenticated user.
- [ ] Cursor-based pagination uses an encoded opaque cursor.
- [ ] Default page size is 20.
- [ ] Filtering supports text search on title/description, `priority`, and `isPurchased`.
- [ ] Sorting supports `createdAt`, `price`, and `priority`.
- [ ] Default sort is `createdAt` descending.
- [ ] Response includes the list of items and the next cursor when more results exist.

## Blocked by

- #7 Create wishlist item with image upload
