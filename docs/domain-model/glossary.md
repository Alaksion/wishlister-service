# Glossary

## Account deactivation
Soft-delete of a user account. Marks the user as inactive, permanently deletes all refresh tokens, and permanently deletes all wishlist items. Reactivation does not restore deleted items.

## Cursor
An opaque, encoded string used by cursor-based pagination to identify the position in a sorted result set.

## Image compression
Server-side reduction of image file size after upload. Accepts some quality loss to reduce storage cost.

## Orphan object
A file stored in S3-compatible storage that is no longer referenced by any wishlist item. Prevented by storing `s3Key` and deleting objects when items are deleted.

## Refresh token
A long-lived JWT (7 days) used to obtain new access tokens. Stored hashed in the database and deleted on revocation.

## S3 key
The unique identifier for an object in S3-compatible storage. Used to delete objects; distinct from the public serving URL.

## Wishlist item
A user-owned record representing a desired product or gift. Always private and scoped to the creating user.
