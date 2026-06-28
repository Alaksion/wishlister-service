## What to build

Implement end-to-end user registration. An anonymous caller can create an account by providing a unique email, display name, and a password that meets market-standard complexity rules. The email should be case-normalized and uniqueness enforced against active users. The password must be hashed before persistence.

On success, return the created user's public profile (excluding the password hash). Return clear validation errors for duplicate emails, weak passwords, or missing fields.

## Acceptance criteria

- [ ] `POST /auth/register` accepts `email`, `displayName`, and `password`.
- [ ] Email is normalized and uniqueness is enforced across active users.
- [ ] Password complexity is validated (min 8 chars, upper, lower, digit, special).
- [ ] Password is hashed with Argon2 or bcrypt before storage.
- [ ] Successful registration returns the user id, email, and display name.
- [ ] Duplicate email returns a 409 error.

## Blocked by

- #1 Bootstrap project foundation
