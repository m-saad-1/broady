# Google OAuth Implementation Details - Broady

## Frontend URI Reference

### Development
```
Frontend:     http://localhost:3000
API:          http://localhost:4000/api
Callback:     http://localhost:4000/api/auth/google/callback
```

### Production (Template)
```
Frontend:     https://your-domain.com
API:          https://api.your-domain.com/api
Callback:     https://api.your-domain.com/api/auth/google/callback
```

---

## Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (http://localhost:3000)          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. User clicks "Sign in with Google"                     │   │
│  │ 2. Google Sign-In popup opens                            │   │
│  │ 3. User completes Google authentication                  │   │
│  │ 4. Google returns ID Token to frontend                   │   │
│  │ 5. Frontend stores token in localStorage                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────┬──────────────────────────────────────────┬──┘
                     │ POST /api/auth/google                     │
                     │ Body: { idToken: "..." }                  │
                     ▼                                            │
┌─────────────────────────────────────────────────────────────────┐
│                   API (http://localhost:4000)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. Receive ID Token from frontend                        │   │
│  │ 2. Verify token signature using google-auth-library      │   │
│  │ 3. Extract payload (email, sub, name)                    │   │
│  │ 4. Check if user exists by googleId                      │   │
│  │ 5. If exists: update user                                │   │
│  │    If not: check by email, then create new               │   │
│  │ 6. Generate JWT session token                            │   │
│  │ 7. Store session in database                             │   │
│  │ 8. Return { token, user }                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────┬──────────────────────────────────────────┬──┘
                     │ Response: { token, user }                │
                     │ Set-Cookie: broady_token                 │
                     ▼                                            │
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (http://localhost:3000)          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. Store JWT token in localStorage                       │   │
│  │ 2. Update auth store with user data                      │   │
│  │ 3. Redirect to dashboard/home                            │   │
│  │ 4. Send token in Authorization header for API calls      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

For subsequent API calls:
Authorization: Bearer <JWT_TOKEN>
Cookie: broady_token=<JWT_TOKEN>
```

---

## Code Files & Their Roles

### Frontend (Web)

**`apps/web/src/lib/auth-client.ts`**
```typescript
// Main auth client for frontend
export async function loginWithGoogleIdToken(idToken: string)
// Sends ID Token to /api/auth/google
// Stores returned JWT in localStorage
// Returns user object
```

**`apps/web/src/stores/auth-store.ts`**
- Zustand store for auth state
- Manages user data and authentication status
- Syncs with localStorage

**`apps/web/src/components/`** (Login/Auth Components)
- `LoginPage` - Login UI
- `SignUpPage` - Registration UI
- Google Sign-In button components

### Backend (API)

**`apps/api/src/modules/auth/auth.routes.ts`**
```typescript
router.post("/google", authBurstLimiter, googleAuthController);
// POST /api/auth/google
// Rate limited to prevent abuse
```

**`apps/api/src/modules/auth/auth.controller.ts`**
```typescript
export async function googleAuthController(req, res)
// Validates request payload
// Calls service function
// Returns response with token and user
```

**`apps/api/src/modules/auth/auth.service.ts`**
```typescript
export async function loginWithGoogle(idToken, meta)
// Verifies Google ID Token using OAuth2Client
// Validates email_verified and payload
// Finds or creates user in database
// Generates session token
// Returns { token, user } or { error }
```

**`apps/api/src/config/env.ts`**
- Loads and validates environment variables
- Ensures `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` exist

---

## Google OAuth2Client Usage

```typescript
import { OAuth2Client } from "google-auth-library";

const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const ticket = await oauthClient.verifyIdToken({
  idToken: idToken,
  audience: GOOGLE_CLIENT_ID,
});

const payload = ticket.getPayload();
// {
//   sub: "google_user_id",
//   email: "user@gmail.com",
//   email_verified: true,
//   name: "User Name",
//   picture: "https://...",
//   ...
// }
```

---

## Database Schema - User Table

```sql
CREATE TABLE "User" (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  googleId VARCHAR UNIQUE,
  fullName VARCHAR,
  password_hash VARCHAR,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP,
  ...
);

CREATE TABLE "Session" (
  id UUID PRIMARY KEY,
  userId UUID NOT NULL,
  token VARCHAR UNIQUE NOT NULL,
  expiresAt TIMESTAMP,
  createdAt TIMESTAMP,
  ...
);
```

---

## Security Considerations

### Input Validation
- ID Token is verified with Google's public key
- Email must be verified (`email_verified: true`)
- Payload structure is validated

### Rate Limiting
- Auth endpoints are rate limited
  - Burst limit: 20 requests per 60s
  - Credential limit: 12 requests per 5 min
- Prevents brute force and abuse

### Token Storage
- Frontend: JWT stored in localStorage
- Also sent as secure cookie: `broady_token`
- Backend: Session record persists in database

### CORS & Same-Origin
- Callback URL must match exactly
- No additional verification needed (Google handles OAuth2 spec)

---

## Environment Variables Checklist

```env
✓ GOOGLE_CLIENT_ID              - From Google Console
✓ GOOGLE_CLIENT_SECRET          - From Google Console (NEVER EXPOSE)
✓ GOOGLE_CALLBACK_URL           - Must match Google Console redirect URI
✓ NEXT_PUBLIC_GOOGLE_CLIENT_ID  - Exposed to frontend (safe)
✓ NEXT_PUBLIC_API_URL           - Frontend's API base URL
✓ WEB_APP_URL                   - Frontend base URL
✓ DATABASE_URL                  - PostgreSQL connection string
✓ JWT_SECRET                    - For signing JWT tokens
```

---

## Error Handling

### Frontend Error Handling
```typescript
try {
  const result = await loginWithGoogleIdToken(idToken);
  if (result.error) {
    // Show error: "Google login failed"
    console.error(result.error.message);
  } else {
    // Success - store token and redirect
    persistAuthToken(result.token);
    redirect("/dashboard");
  }
} catch (error) {
  // Network error
  console.error("Login failed:", error);
}
```

### API Error Responses

| Status | Error | Meaning |
|--------|-------|---------|
| 400 | Invalid payload | Missing or malformed idToken |
| 401 | Invalid Google token | Token signature/exp verification failed |
| 503 | Google OAuth not configured | `GOOGLE_CLIENT_ID` not set |
| 500 | Database error | User creation/lookup failed |

---

## Testing Commands

### 1. Verify Environment Variables
```bash
echo $env:GOOGLE_CLIENT_ID
echo $env:GOOGLE_CLIENT_SECRET
```

### 2. Check API Health
```bash
curl http://localhost:4000/health
```

### 3. Check if OAuth is Configured
```bash
curl http://localhost:4000/api/auth/me -H "Authorization: Bearer invalid"
# Should return 401 (not 503)
```

### 4. Test with Mock Token (will fail but shows endpoint works)
```bash
curl -X POST http://localhost:4000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"invalid_token"}' \
  -w "\nStatus: %{http_code}\n"
```

---

## Deployment Considerations

### Pre-Deployment Checklist

- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- [ ] `GOOGLE_CALLBACK_URL` matches production domain
- [ ] Frontend URI is set to production domain
- [ ] Database URL points to production database
- [ ] JWT_SECRET is strong and unique
- [ ] `.env` file is NOT committed to git
- [ ] `.env.example` is up-to-date
- [ ] Rate limiting is appropriate for traffic
- [ ] HTTPS is enforced in production
- [ ] CORS is configured correctly
- [ ] Monitoring and logging are in place

### Production Environment Variables

```env
# Update for production domain
GOOGLE_CALLBACK_URL=https://api.your-domain.com/api/auth/google/callback
NEXT_PUBLIC_API_URL=https://api.your-domain.com/api
WEB_APP_URL=https://your-domain.com
```

Update Google Console redirect URIs to:
```
https://api.your-domain.com/api/auth/google/callback
```

---

## Debugging Tips

### Enable Debug Logging
Add to auth.service.ts:
```typescript
console.log("Received idToken:", idToken);
console.log("Verified payload:", payload);
console.log("User found/created:", user);
```

### Check Token Claims
Paste JWT at [jwt.io](https://jwt.io) to see claims

### Verify Google Token
Use Google's tokeninfo endpoint:
```bash
curl "https://www.googleapis.com/oauth2/v1/tokeninfo?id_token=YOUR_TOKEN"
```

### Check Database Records
```bash
# Connect to PostgreSQL
psql -U postgres -d broady -c "SELECT id, email, googleId FROM \"User\" LIMIT 10;"
```
