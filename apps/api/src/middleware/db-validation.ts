import type { Request, Response, NextFunction } from "express";
import { validateDBConnection } from "../utils/db-health.js";

/**
 * DB Connection Validation Middleware
 * 
 * Ensures database is available before processing API requests.
 * Returns 503 Service Unavailable if DB is unreachable.
 * 
 * AUTO-VERIFY BEHAVIOR: This middleware automatically checks DB connectivity
 * on every incoming request to ensure the application never processes
 * requests against a dead database connection.
 */

export async function validateDBConnectionMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const isConnected = await validateDBConnection();
    
    if (!isConnected) {
      console.error("[middleware] database connection check failed; returning 503");
      res.status(503).json({
        message: "Database is temporarily unavailable. Please retry in a moment.",
        code: "DB_CONNECTION_CHECK_FAILED",
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error("[middleware] unexpected error during db connection check", error);
    res.status(503).json({
      message: "Database connectivity check failed. Please retry.",
      code: "DB_HEALTH_CHECK_ERROR",
    });
  }
}
