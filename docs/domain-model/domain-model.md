# Domain Model — Wishlister

## Context
Backend service for managing user accounts and private wishlisted items. Built with Node.js, Express, and MongoDB (AWS DocumentDB).

## Core Entities

### User
| Field | Type | Notes |
|-------|------|-------|
| id | ObjectId | Primary identifier |
| email | string | Unique, used for login |
| displayName | string | Public-facing name |
| passwordHash | string | Argon2/bcrypt hash |
| isActive | boolean | Soft-delete flag |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Invariants**
- Email must be unique across active users (case-normalized).
- `displayName` required, max 100 chars.
- Password must meet market-standard complexity (min 8 chars, upper, lower, digit, special).
- On `isActive = false` (deactivation): all refresh tokens are revoked and all wishlist items are permanently deleted.
- Reactivation does not restore deleted items.

### WishlistItem
| Field | Type | Notes |
|-------|------|-------|
| id | ObjectId | |
| userId | ObjectId | Ref to User; strict ownership |
| title | string | Required, max 200 chars |
| description | string | Optional, max 2000 chars |
| url | string | Optional, valid URL format only |
| price | integer | Stored in cents (e.g., 1000 = $10.00) |
| currency | string | ISO 4217 code, defaults to USD |
| priority | enum | low / medium / high |
| isPurchased | boolean | Defaults to false |
| images | Image[] | Max 3 per item |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Invariants**
- Items are always owned by exactly one user; no sharing, no admin access.
- Duplicate items (same title/url) are allowed.
- Maximum 3 images per item.
- Image upload: each file ≤ 5 MB, MIME type restricted to image/jpeg, image/png, image/webp.
- Images are compressed server-side (quality reduction acceptable, no severe loss), then uploaded to S3-compatible storage.
- Both `s3Key` and public serving `url` are stored; `s3Key` enables deletion.
- On item deletion, associated S3 objects must be deleted to prevent orphans.
- `isPurchased` can be toggled freely.

### Image (value object)
| Field | Type | Notes |
|-------|------|-------|
| s3Key | string | Used for deletion |
| url | string | Public serving URL |
| originalName | string | Optional, for display |
| uploadedAt | DateTime | |

### RefreshToken
| Field | Type | Notes |
|-------|------|-------|
| id | ObjectId | |
| userId | ObjectId | |
| tokenHash | string | Hashed token value |
| expiresAt | DateTime | 7 days from issuance |
| createdAt | DateTime | |

**Invariants**
- One token per session/device.
- Revocation deletes the record.
- Account deactivation deletes all refresh tokens for the user.
- "Log out other devices" deletes all refresh tokens except the one in the current request.

## Authentication

- JWT access tokens: 15-minute expiry.
- JWT refresh tokens: 7-day expiry, persisted and hashed.
- Every authenticated request validates the access token and checks that the user account is still active.
- Deactivated accounts immediately lose access, even if tokens are unexpired.

## API Shape (REST/JSON)

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`

### Users
- `PATCH /users/me`
- `DELETE /users/me` (deactivate)

### Wishlist Items
- `POST /items`
- `GET /items` (cursor pagination, filters, sorting)
- `GET /items/:id`
- `PATCH /items/:id`
- `DELETE /items/:id`

## Pagination, Filtering, Sorting

- Cursor-based pagination with encoded opaque cursor.
- Default page size: 20; max page size TBD.
- Filters: text search on `title`/`description`, `priority`, `isPurchased`.
- Sortable: `createdAt`, `price`, `priority`.
- Default sort: `createdAt` descending (newest first).

## Glossary

- **Account deactivation**: Soft-delete of the user. Irreversibly removes all refresh tokens and wishlist items.
- **Item deletion**: Hard delete of the wishlist item record and its S3 objects.
- **Orphan object**: S3 object no longer referenced by any item. Prevented by storing `s3Key`.
- **Cursor**: Opaque encoded string representing the pagination position.
