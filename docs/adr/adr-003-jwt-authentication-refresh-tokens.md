# ADR-003: JWT Authentication with Refresh Tokens

## Status

Accepted

## Context

Users authenticate via email/password. Access tokens should be short-lived; refresh tokens enable session continuity.

## Decision

- Issue JWT access tokens with 15-minute expiry.
- Issue JWT refresh tokens with 7-day expiry and persist a hash of each token in MongoDB.
- Validate user account active status on every authenticated request.
- Delete refresh token records on revocation.
- On account deactivation, delete all refresh tokens.
- "Log out other devices" deletes all refresh tokens except the current one.

## Rationale

- Short access tokens limit exposure window.
- Persisted refresh tokens allow revocation and multi-device session management.
- Active-status check on every request ensures deactivated accounts lose access immediately.

## Consequences

- Every authenticated request requires a database lookup for user active status.
- Token management adds endpoint surface area (refresh, logout, logout-all).
