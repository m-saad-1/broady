# Auth Refresh Cookie-First Design

**Goal:** Add a secure refresh-token flow, cookie-first auth, and integration tests that cover register/verify/login/refresh/logout/password reset.

## Scope
- Add refresh token support with rotation and server-side revocation.
- Centralize configurable cookie settings for dev and production.
- Align web client to cookie-first auth (no localStorage tokens).
- Keep Authorization header support for non-browser clients.
- Add integration tests for core auth flows.

## Non-Goals
- Replacing the existing auth provider options.
- Changing user roles or permissions semantics.
- Adding MFA.

## Architecture Overview
- **Access token**: short-lived JWT (default 15 minutes) for API authorization.
- **Refresh token**: long-lived JWT (default 30 days) used only by `/api/auth/refresh`.
- **Session storage**: keep server-side session record and store a hashed refresh token id for rotation/revocation.
- **Cookie-first**: browser uses httpOnly cookies only; Authorization header is supported for non-browser clients.

## Token Model
### Access Token JWT
- Claims: `userId`, `role`, `brandId`, `sessionId`, `tokenId`, `type=access`.
- TTL: 15 minutes (configurable).

### Refresh Token JWT
- Claims: `sessionId`, `refreshId`, `type=refresh`.
- TTL: 30 days (configurable).
- `refreshId` is rotated on every refresh.

### Server-Side Session Fields
- Store `refreshTokenHash`, `refreshTokenExpiresAt`, `refreshTokenRevokedAt`, `lastRefreshedAt`.
- Refresh rotation updates hash + expiry and revokes previous refresh id.

## Endpoints
### `POST /api/auth/refresh`
- Validates refresh token.
- Checks session not revoked, refresh token hash matches, not expired.
- Rotates refresh token and issues new access token.
- Sets new cookies and returns current user + access token in response body for non-browser clients.

### `POST /api/auth/logout`
- Revokes session refresh token server-side.
- Clears access + refresh cookies.

## Cookie Strategy
### Centralized Cookie Config
Single helper produces cookie options:
- `httpOnly: true`
- `secure`: `true` in production, `false` for localhost dev (configurable)
- `sameSite`: `lax` by default for localhost dev; `none` for cross-site production if configured
- `domain`: optional env override
- `path: "/"`
- `maxAge`: separate values for access and refresh tokens

### Cookie Names
- Access: `broady_access`
- Refresh: `broady_refresh`
- Optional CSRF: `broady_csrf` (non-httpOnly)

## CSRF Safety
- Default **SameSite=Lax** for localhost dev and same-site production.
- When SameSite must be `none`, require **double-submit** CSRF token:
  - Server sets `broady_csrf` cookie (non-httpOnly).
  - Client sends `x-csrf-token` header with same value on refresh/logout.
  - Server validates header vs cookie.
- Enforce Origin allowlist for refresh/logout when `sameSite=none`.

## Frontend Behavior
- **No localStorage tokens**. Browser relies on cookies and `credentials: "include"`.
- `authFetch`:
  - On `401` with `AUTH_TOKEN_EXPIRED`, call `/auth/refresh` once and retry.
  - If refresh fails, clear auth state and redirect to login.
- Keep Authorization header support only for non-browser clients.

## Tests (Integration)
- Register: creates user, no access until verified.
- Email verification: verifies account and issues cookies.
- Login: issues cookies, `/auth/me` returns user.
- Refresh: rotates refresh token and renews access token.
- Logout: revokes refresh token, clears cookies.
- Password reset: resets password and revokes existing sessions.

## Config Additions
- Access/refresh TTLs, cookie flags (secure/sameSite/domain), CSRF enforcement toggle.

## Risks & Mitigations
- **CSRF risk**: mitigate with SameSite=Lax by default and double-submit token for SameSite=None.
- **Refresh token theft**: mitigate with rotation and server-side revocation.
- **Clock skew**: allow small tolerance when validating expiry.
