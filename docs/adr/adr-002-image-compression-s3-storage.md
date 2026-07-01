# ADR-002: Image Compression and S3-Compatible Storage

## Status

Accepted

## Context

Wishlist items support up to 3 image attachments. Images must be limited to 5 MB each at upload and compressed server-side to reduce storage cost.

## Decision

- Validate each uploaded image: ≤ 5 MB, MIME type in `image/jpeg`, `image/png`, `image/webp`.
- Compress images server-side with acceptable quality loss.
- Upload compressed images to an S3-compatible service.
- Store both the S3 key (for deletion) and public URL (for serving).
- Delete S3 objects when the parent item is deleted.

## Rationale

- Prevents orphan storage objects and runaway storage costs.
- Public URLs keep read access simple for the first release.
- Storing the S3 key allows reliable cleanup.

## Consequences

- Server must handle CPU-bound compression work.
- Image update is not supported in v1; replacement requires delete + recreate.
