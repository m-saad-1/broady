# Google OAuth Setup Checklist - Step by Step

## ✅ QUICK START (10 Minutes)

### [ ] Step 1: Create Google Cloud Project (2 min)
- [ ] Go to https://console.cloud.google.com/
- [ ] Click project dropdown (top)
- [ ] Click **NEW PROJECT**
- [ ] Name: `Broady Testing`
- [ ] Click **CREATE**
- [ ] Wait and select new project

### [ ] Step 2: Enable Google+ API (1 min)
- [ ] Go to **APIs & Services** → **Library**
- [ ] Search: `Google+ API`
- [ ] Click result
- [ ] Click **ENABLE**

### [ ] Step 3: Setup OAuth Consent Screen (2 min)
- [ ] Go to **APIs & Services** → **OAuth consent screen**
- [ ] Select **External**
- [ ] Click **CREATE**
- [ ] **App name**: `Broady`
- [ ] **User support email**: `msaad23305@gmail.com`
- [ ] **Developer email**: `msaad23305@gmail.com`
- [ ] Click **SAVE AND CONTINUE**
- [ ] Click **SAVE AND CONTINUE** (scopes page)
- [ ] Click **ADD USERS** (test users page)
- [ ] Add your Gmail address
- [ ] Click **SAVE AND CONTINUE**
- [ ] Review and click **BACK TO DASHBOARD**

### [ ] Step 4: Create OAuth Credentials (2 min)
- [ ] Go to **APIs & Services** → **Credentials**
- [ ] Click **+ CREATE CREDENTIALS** → **OAuth client ID**
- [ ] Choose **Web application**
- [ ] **Name**: `Broady Web App`
- [ ] Scroll down

**Authorized JavaScript origins:**
- [ ] Add: `http://localhost:3000`
- [ ] Add: `http://localhost:4000`

**Authorized redirect URIs:**
- [ ] Add: `http://localhost:4000/api/auth/google/callback`
- [ ] Add: `http://localhost:3000/auth/google/callback`

- [ ] Click **CREATE**
- [ ] **COPY** `Client ID`
- [ ] **COPY** `Client Secret`
- [ ] Close popup

### [ ] Step 5: Update .env File (2 min)
Edit `d:\WEB DEVELOPMENT\broady\.env`:

```env
GOOGLE_CLIENT_ID=PASTE_YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=PASTE_YOUR_CLIENT_SECRET_HERE
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
NEXT_PUBLIC_GOOGLE_CLIENT_ID=PASTE_YOUR_CLIENT_ID_HERE
NEXT_PUBLIC_API_URL=http://localhost:4000/api
WEB_APP_URL=http://localhost:3000
```

- [ ] Save the file

### [ ] Step 6: Start Application (1 min)
Open PowerShell in the repository root:

```powershell
# Install dependencies
npm install

# Start infrastructure
npm run db:up

# Start both web and API
npm run dev
```

Wait for output showing:
- [ ] `http://localhost:3000` - Web running
- [ ] `http://localhost:4000` - API running

---

## ✅ TESTING PHASE

### [ ] Test 1: Frontend Login
- [ ] Open browser to `http://localhost:3000`
- [ ] Look for **Sign in with Google** button
- [ ] Click it
- [ ] Complete Google authentication
- [ ] Verify you're logged in
- [ ] Check browser console (F12 → Console) for errors

### [ ] Test 2: Health Check
Open PowerShell and run:
```powershell
curl http://localhost:4000/health
```

Expected output contains: `"status":"healthy"`

- [ ] Database is healthy

### [ ] Test 3: Auth Status
```powershell
curl http://localhost:4000/api/auth/me `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -UseBasicParsing
```

- [ ] Returns user object (or 401 if no token)

---

## ✅ VERIFICATION

### Frontend URIs - Verify these are correct

| Purpose | URI | Status |
|---------|-----|--------|
| Frontend | `http://localhost:3000` | [ ] Working |
| API | `http://localhost:4000/api` | [ ] Working |
| Callback | `http://localhost:4000/api/auth/google/callback` | [ ] Configured |

### Environment Variables - Verify these are set

| Variable | Value | Verified |
|----------|-------|----------|
| `GOOGLE_CLIENT_ID` | From Google Console | [ ] ✓ |
| `GOOGLE_CLIENT_SECRET` | From Google Console | [ ] ✓ |
| `GOOGLE_CALLBACK_URL` | `http://localhost:4000/api/auth/google/callback` | [ ] ✓ |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Same as above | [ ] ✓ |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | [ ] ✓ |
| `WEB_APP_URL` | `http://localhost:3000` | [ ] ✓ |

### Database - Verify connection

```powershell
curl http://localhost:4000/health -UseBasicParsing
```

Response should include:
```json
{
  "status": "healthy",
  "connected": true,
  "message": "Database connection is healthy and responsive"
}
```

- [ ] Database is connected

---

## ✅ TROUBLESHOOTING

### Problem: "Google OAuth is not configured" (503 error)

**Fix:**
- [ ] Check `.env` file has `GOOGLE_CLIENT_ID` filled in
- [ ] Check `.env` file has `GOOGLE_CLIENT_SECRET` filled in
- [ ] Restart API server: `npm run dev:api`
- [ ] Test again

### Problem: "Invalid Google token" (401 error)

**Fix:**
- [ ] Ensure ID token is not expired (< 1 hour old)
- [ ] Ensure token comes from your Google project (Client ID matches)
- [ ] Verify token payload: https://jwt.io/

### Problem: "Redirect URI mismatch"

**Fix:**
- [ ] Compare `GOOGLE_CALLBACK_URL` in `.env` with Google Console
- [ ] They must match exactly
- [ ] Default: `http://localhost:4000/api/auth/google/callback`
- [ ] Restart API server after changing

### Problem: CORS error on frontend

**Fix:**
- [ ] Verify `NEXT_PUBLIC_API_URL=http://localhost:4000/api`
- [ ] Verify API is running: `curl http://localhost:4000`
- [ ] Check browser console for specific CORS error
- [ ] Restart web server: `npm run dev:web`

### Problem: Can't find "Sign in with Google" button

**Fix:**
- [ ] Button may be on login page (not home)
- [ ] Check `/auth/login` or `/login` routes
- [ ] Check browser console (F12 → Console) for errors
- [ ] Verify frontend is loading (check `http://localhost:3000`)

### Problem: Database connection error

**Fix:**
- [ ] Ensure PostgreSQL is running: `npm run db:up`
- [ ] Check `DATABASE_URL` in `.env` is correct
- [ ] Default: `postgresql://postgres:postgre123@localhost:5432/broady`
- [ ] Wait 10 seconds for DB to initialize
- [ ] Check database is healthy: `curl http://localhost:4000/health`

---

## 📋 CREDENTIALS SUMMARY

Save these securely after setup:

```
Project: Broady Testing
Client ID: YOUR_CLIENT_ID
Client Secret: YOUR_CLIENT_SECRET

OAuth Endpoints:
- Authorization: https://accounts.google.com/o/oauth2/auth
- Token: https://oauth2.googleapis.com/token
- Callback: http://localhost:4000/api/auth/google/callback
```

**⚠️ NEVER commit Client Secret to git!**

---

## 🔒 Security Best Practices

- [ ] `.env` file is in `.gitignore`
- [ ] `.env.example` exists with placeholders
- [ ] Client Secret is never logged or exposed
- [ ] Always use HTTPS in production
- [ ] Update OAuth consent screen before production
- [ ] Test with test users in Google Console first
- [ ] Monitor failed login attempts
- [ ] Rotate secrets annually

---

## ✅ Final Checklist

- [ ] Google Cloud Project created
- [ ] Google+ API enabled
- [ ] OAuth consent screen configured
- [ ] OAuth credentials created
- [ ] Client ID and Secret copied
- [ ] `.env` file updated with credentials
- [ ] Dependencies installed (`npm install`)
- [ ] Database started (`npm run db:up`)
- [ ] Application running (`npm run dev`)
- [ ] Frontend loads at `http://localhost:3000`
- [ ] API responds at `http://localhost:4000/api`
- [ ] Google OAuth login works
- [ ] User is authenticated after login
- [ ] Database health check passes
- [ ] No errors in console/logs

---

## 📚 Documentation

Created files in the repository:
- [ ] `GOOGLE_OAUTH_SETUP_TESTING.md` - Complete guide
- [ ] `GOOGLE_OAUTH_QUICK_REFERENCE.md` - Quick reference
- [ ] `GOOGLE_OAUTH_IMPLEMENTATION_DETAILS.md` - Technical details
- [ ] `GOOGLE_OAUTH_SETUP_CHECKLIST.md` - This file

---

## 🚀 Ready to Deploy?

Once local testing is complete, see `GOOGLE_OAUTH_SETUP_TESTING.md` **Deployment Considerations** section for:
- Production environment variables
- Google Console updates for production domain
- Security checklist before going live

---

**Questions?** Check the troubleshooting section above or review the full documentation files.
