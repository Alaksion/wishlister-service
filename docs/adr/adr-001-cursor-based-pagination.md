# ADR-001: Cursor-Based Pagination for Wishlist Items

## Status

Accepted

## Context

The wishlist list endpoint must support pagination, filtering, and sorting. Users may have large lists over time, and efficient, stable pagination is required.

## Decision

Use cursor-based pagination with an encoded opaque cursor.

## Rationale

- Provides stable result sets when items are created or updated during pagination.
- Avoids offset-based performance degradation on large collections.
- Encoded opaque cursors prevent clients from constructing invalid pagination states.

## Consequences

- Clients cannot jump to arbitrary pages.
- Implementation must encode/decode cursor values (likely `createdAt` + `_id`).
