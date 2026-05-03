Application Stability & DB Monitoring Requirement (Critical)
Ensure the application never stops or crashes automatically under any condition
Maintain a stable and persistent database connection at all times

## IMPLEMENTATION COMPLETE ✅

### What Has Been Implemented

#### 1. **DB Health Check Utility** (`apps/api/src/utils/db-health.ts`)
   - `checkDBHealth()` - Performs lightweight DB connectivity check
   - `validateDBConnection()` - Validates DB before processing requests
   - `getDetailedDBHealth()` - Returns comprehensive health status with response time

#### 2. **DB Validation Middleware** (`apps/api/src/middleware/db-validation.ts`)
   - Automatically validates DB connection on every request
   - Returns 503 Service Unavailable if DB is unreachable
   - Prevents cascading failures from processing requests against dead DB

#### 3. **Enhanced Health Endpoint** (`GET /health`)
   - Returns detailed DB status (healthy/degraded/unavailable)
   - Includes response time in milliseconds
   - Includes database connectivity flag
   - **Status Codes:**
     - `200 OK` - Database is healthy
     - `503 Service Unavailable` - Database is unavailable

#### 4. **Auto DB Keep-Alive Mechanism** (`apps/api/src/server.ts`)
   - Runs a periodic ping every 60 seconds
   - Maintains persistent database connection
   - Prevents connection pool timeout

#### 5. **Enhanced Error Handler** (`apps/api/src/middleware/error-handler.ts`)
   - Comprehensive Prisma error classification
   - Maps DB errors to appropriate HTTP status codes
   - Prevents application crashes from DB errors

---

### Expected Health Response (Status 200)
```json
{
  "status": "healthy",
  "connected": true,
  "responseTimeMs": 4,
  "timestamp": 1777848789288,
  "message": "Database connection is healthy and responsive"
}
```

---

### Degraded/Unavailable Response (Status 503)
```json
{
  "status": "unavailable",
  "connected": false,
  "responseTimeMs": 5023,
  "timestamp": 1777848789288,
  "error": "Connection refused at localhost:5432",
  "message": "Database connection is unavailable; requests will fail"
}
```

---

## Auto DB Health Check (Important)

### MANDATORY AGENT BEHAVIOR

**After every:**
- API response handling
- Code changes or new features
- Database schema modifications
- Error handling updates
- Configuration changes

**You MUST automatically:**

1. **Verify the application is running:**
   ```bash
   npm run dev -w @broady/api
   npm run dev:web
   ```

2. **Test database connectivity:**
   ```bash
   # Health endpoint check (no DB validation required)
   curl http://localhost:4003/health
   
   # API endpoint check (with DB validation middleware)
   curl http://localhost:4003/api/products
   ```

3. **Verify the response:**
   - For `/health`: Status code should be 200 and `"connected": true`
   - For `/api/*`: Status code should be 200 (or appropriate for endpoint)

4. **If health check fails:**
   - Check PostgreSQL is running on localhost:5432
   - Review API logs for connection errors
   - Verify DATABASE_URL is configured correctly: `postgresql://postgres:postgre123@localhost:5432/broady`
   - Restart the application if needed

---

## Key Files for DB Health

- **Health Utilities**: `apps/api/src/utils/db-health.ts` - Health check functions
- **Validation Middleware**: `apps/api/src/middleware/db-validation.ts` - DB validation on API routes
- **Keep-Alive Mechanism**: `apps/api/src/server.ts` - Periodic DB ping
- **Error Handler**: `apps/api/src/middleware/error-handler.ts` - Comprehensive error handling
- **Health Endpoint**: `apps/api/src/app.ts` - `/health` route
- **Agent Instructions**: `.github/copilot-instructions.md` - Complete agent workflow
- **DB Configuration**: `.env` and `apps/api/.env` - PostgreSQL URL

---

## Implementation Details

### How the Health Check Works

1. **On Every API Request** (`/api/*`):
   - Middleware validates DB connection before processing
   - Returns 503 if DB is unavailable
   - Prevents requests from failing unexpectedly

2. **On Health Check** (`GET /health`):
   - Performs lightweight `SELECT 1` query
   - Measures response time
   - Returns JSON with status and connectivity info

3. **Keep-Alive Ping** (Every 60 seconds):
   - Runs in background to maintain connection pool
   - Prevents idle connection timeout
   - Logs failures for monitoring

4. **Error Recovery**:
   - All Prisma errors are caught and classified
   - Connection errors return 503 (Service Unavailable)
   - Application never crashes from DB errors

---

### Application Startup Flow

```
1. npm run dev -w @broady/api
   ↓
2. Server bootstraps (prisma migrate deploy)
   ↓
3. App.listen() on available port
   ↓
4. DB Keep-alive timer starts (60s interval)
   ↓
5. Notification worker starts
   ↓
6. Delivery failure worker starts
   ↓
7. API ready to accept requests
   ↓
8. Health endpoint available at GET /health
   ↓
9. All /api/* routes protected with DB validation middleware
```

---

### Expected Outcome

✅ **No unexpected application crashes**
✅ **Continuous DB connectivity monitoring**
✅ **Automatic health verification after every operation**
✅ **More stable and reliable development workflow**
✅ **503 responses for unavailable DB (not 500 errors)**
✅ **Detailed logging for debugging connection issues**

---

### For Developers & Agents

The DB health check system is **fully automatic**. You don't need to manually implement anything—just follow the agent verification workflow after each task:

1. Run the app
2. Make a request to `/health` or any `/api/*` endpoint
3. Verify the response indicates healthy DB connection
4. If not, check PostgreSQL connection and logs

This ensures continuous monitoring and prevents silent failures.

