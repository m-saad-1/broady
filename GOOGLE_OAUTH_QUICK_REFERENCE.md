# Google OAuth Quick Reference

## URIs

| Purpose | URI |
|---------|-----|
| **Frontend** | `http://localhost:3000` |
| **API** | `http://localhost:4000/api` |
| **OAuth Callback** | `http://localhost:4000/api/auth/google/callback` |

---

## Google Console Setup (5 Min)

1. **Create Project**: [Google Cloud Console](https://console.cloud.google.com/) → New Project
2. **Enable API**: APIs & Services → Library → Search "Google+ API" → Enable
3. **OAuth Consent**: APIs & Services → OAuth consent screen → External → Fill details
4. **Credentials**: APIs & Services → Credentials → Create → OAuth 2.0 Web Application

### Authorized Origins (JavaScript Origins)
```
http://localhost:3000
http://localhost:4000
```

### Authorized Redirect URIs
```
http://localhost:4000/api/auth/google/callback
http://localhost:3000/auth/google/callback
```

---

## Environment Variables (.env)

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_API_URL=http://localhost:4000/api
WEB_APP_URL=http://localhost:3000
```

---

## Start Application

```bash
npm install
npm run db:up
npm run dev
```

---

## Test OAuth

1. Open `http://localhost:3000`
2. Click "Sign in with Google"
3. Complete Google authentication
4. You should be logged in!

---

## API Test (cURL)

```bash
# After getting Google ID Token
curl -X POST http://localhost:4000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"YOUR_GOOGLE_ID_TOKEN"}'
```

---

## Health Check

```bash
curl http://localhost:4000/health
```

Expected: `{"status":"healthy","connected":true}`
