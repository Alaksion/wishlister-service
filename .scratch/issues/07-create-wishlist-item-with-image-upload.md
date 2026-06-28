## What to build

Implement wishlist item creation. An authenticated user can `POST /items` to create an item with `title`, optional `description`, optional `url`, optional `price` (in cents), optional `currency` (defaults to USD), `priority`, and up to 3 image attachments.

Images are validated individually: each must be ≤ 5 MB and one of `image/jpeg`, `image/png`, or `image/webp`. Valid images are compressed server-side with acceptable quality loss, then uploaded to an S3-compatible service. The item stores both the S3 key and the public serving URL for each image. The item is owned by the authenticated user.

## Acceptance criteria

- [ ] `POST /items` creates an item owned by the authenticated user.
- [ ] Required fields are validated; `title` is required and max 200 chars.
- [ ] `url` is optional but must be a valid URL format when provided.
- [ ] `price` is stored in cents; `currency` defaults to USD.
- [ ] Up to 3 images are accepted; each ≤ 5 MB and limited to JPEG/PNG/WebP.
- [ ] Images are compressed and uploaded to S3-compatible storage.
- [ ] Both `s3Key` and public `url` are stored for each image.
- [ ] Returns the created item including image URLs.

## Blocked by

- #4 Authenticated requests and logout
- #1 Bootstrap project foundation
