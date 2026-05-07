# Google OAuth Setup for Testing - Complete Guide

## Frontend URI
```
http://localhost:3000
```

## API Base URL
```
http://localhost:4000/api
```

## Google OAuth Callback URL
```
http://localhost:4000/api/auth/google/callback
```

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click **NEW PROJECT**
4. Enter project name: `Broady Testing` (or any name)
5. Click **CREATE**
6. Wait for the project to be created, then select it

---

## Step 2: Enable Google+ API

1. In the Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for **Google+ API**
3. Click on it and click **ENABLE**

---

## Step 3: Create OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** for User Type
3. Click **CREATE**
4. Fill in the form:
   - **App name**: `Broady`
   - **User support email**: `msaad23305@gmail.com`
   - **Developer contact**: `msaad23305@gmail.com`
5. Click **SAVE AND CONTINUE**
6. On **Scopes** page, click **SAVE AND CONTINUE** (default scopes are fine)
7. On **Test users** page, click **ADD USERS** and add your Google account email
8. Click **SAVE AND CONTINUE**
9. Review and click **BACK TO DASHBOARD**

---

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Select **Web application**
4. Configure:
   - **Name**: `Broady Web App` (or any name)
   
5. Under **Authorized JavaScript origins**, add:
   ```
   http://localhost:3000
   http://localhost:4000
   ```

6. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:4000/api/auth/google/callback
   http://localhost:3000/auth/google/callback
   ```

7. Click **CREATE**

---

## Step 5: Copy Credentials

After clicking CREATE, you'll see a modal with:
- **Client ID** 
- **Client Secret**

**Copy both values** - you'll need them in the next step.

---

## Step 6: Configure Environment Variables

### Root `./.env` file

Update the following variables in `d:\WEB DEVELOPMENT\broady\.env`:

```env
# --- OAuth ---
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE

# --- Web Runtime ---
NEXT_PUBLIC_API_URL=http://localhost:4000/api
WEB_APP_URL=http://localhost:3000
```

### API `.env` file (if separate)

Update `apps/api/.env`:

```env
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
```

---

## Step 7: Start the Application

From the repository root:

```bash
# Install dependencies
npm install

# Start local infrastructure (PostgreSQL + Redis)
npm run db:up

# Start both web and API in dev mode
npm run dev
```

Or start them separately:
```bash
# Terminal 1 - API
npm run dev:api

# Terminal 2 - Web
npm run dev:web
```

---

## Step 8: Test Google OAuth

### Option A: Using Web UI

1. Go to `http://localhost:3000`
2. Click on login or sign up
3. Look for **Sign in with Google** button
4. Click it and follow Google's authentication flow
5. You should be authenticated and redirected

### Option B: Using API Directly (cURL)

1. Get a Google ID Token from [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
   - Or use your browser's developer tools to extract the token from the redirect

2. Call the API:
```bash
curl -X POST http://localhost:4000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"YOUR_GOOGLE_ID_TOKEN_HERE"}'
```

Expected response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "email": "your-email@gmail.com",
    "fullName": "Your Name",
    "googleId": "google-user-id"
  }
}
```

---

## Step 9: Verify Database Connectivity

After testing OAuth, verify database health:

```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "status": "healthy",
  "connected": true,
  "responseTimeMs": 5,
  "timestamp": 1234567890000,
  "message": "Database connection is healthy and responsive"
}
```

---

## Troubleshooting

### Issue: "Google OAuth is not configured"
- **Solution**: Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`
- Restart the API server after updating `.env`

### Issue: "Invalid Google token"
- **Solution**: Ensure the ID token is valid and not expired
- The token should have `email_verified: true`
- Verify the audience matches `GOOGLE_CLIENT_ID`

### Issue: Redirect URI mismatch
- **Solution**: Ensure `GOOGLE_CALLBACK_URL` in `.env` exactly matches the registered redirect URI in Google Console
- Default: `http://localhost:4000/api/auth/google/callback`

### Issue: CORS errors on frontend
- **Solution**: Ensure `NEXT_PUBLIC_API_URL` is set to `http://localhost:4000/api` in `.env`
- Check that the API is running on port 4000

### Issue: "Unauthorized" when accessing `/auth/me`
- **Solution**: The token should be automatically stored in localStorage
- Check browser DevTools → Application → Local Storage for `broady_access_token`

---

## Architecture Overview

### Frontend Flow
1. User clicks "Sign in with Google"
2. Frontend uses [Google Sign-In library](https://developers.google.com/identity/gsi/web)
3. Google returns an ID Token
4. Frontend sends ID Token to `/api/auth/google`
5. API validates token and returns JWT session token
6. Frontend stores token in localStorage and cookies

### Backend Flow
1. API receives ID Token at `POST /api/auth/google`
2. Validates using `google-auth-library`
3. Extracts email and Google ID
4. Creates or updates user in database
5. Generates JWT session token
6. Returns token and user data

### Key Files
- `apps/web/src/lib/auth-client.ts` - Frontend auth functions
- `apps/api/src/modules/auth/` - Auth module
  - `auth.routes.ts` - Route definitions
  - `auth.controller.ts` - Request handling
  - `auth.service.ts` - Business logic
  - `auth.schemas.ts` - Validation schemas

---

## Environment Variables Summary

| Variable | Value | Location |
|----------|-------|----------|
| `GOOGLE_CLIENT_ID` | From Google Console | `.env`, `apps/api/.env` |
| `GOOGLE_CLIENT_SECRET` | From Google Console | `.env`, `apps/api/.env` |
| `GOOGLE_CALLBACK_URL` | `http://localhost:4000/api/auth/google/callback` | `.env`, `apps/api/.env` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Same as `GOOGLE_CLIENT_ID` | `.env` (exposed to frontend) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | `.env` |
| `WEB_APP_URL` | `http://localhost:3000` | `.env` |
| `DATABASE_URL` | PostgreSQL connection string | `.env`, `apps/api/.env` |

---

## Next Steps

After successful testing:

1. **Production Deployment**:
   - Use production Google OAuth credentials
   - Update URIs to your production domain
   - Use environment-specific `.env` files

2. **Security**:
   - Never commit `.env` files to git
   - Use `.env.example` as template
   - Rotate secrets regularly

3. **Testing**:
   - Set up test user accounts in Google Console
   - Test with different Google accounts
   - Verify error handling

4. **Monitoring**:
   - Log authentication events
   - Monitor failed login attempts
   - Track user creation/update metrics
