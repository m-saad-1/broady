import { prisma } from "../config/prisma.js";

/**
 * DB Health Check Utility
 * 
 * This module provides database connectivity and health status checks.
 * Used by middleware, health endpoints, and startup validation.
 * 
 * AUTO-VERIFY: After every API response, code change, or feature implementation,
 * this health check ensures the database connection is responsive.
 */

export type DBHealthStatus = {
  status: "healthy" | "degraded" | "unavailable";
  connected: boolean;
  responseTimeMs: number;
  timestamp: number;
  error?: string;
};

/**
 * Performs a lightweight DB connectivity check
 * @returns DBHealthStatus with connection status and response time
 */
export async function checkDBHealth(): Promise<DBHealthStatus> {
  const startTime = Date.now();
  
  try {
    // Execute a simple query to verify connection
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTimeMs = Date.now() - startTime;
    
    return {
      status: "healthy",
      connected: true,
      responseTimeMs,
      timestamp: Date.now(),
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Classify the error severity
    const isInitializationError = errorMessage.includes("initialization") || errorMessage.includes("ECONNREFUSED");
    const isDegraded = responseTimeMs > 5000; // Slow response indicates degradation
    
    return {
      status: isInitializationError ? "unavailable" : isDegraded ? "degraded" : "degraded",
      connected: false,
      responseTimeMs,
      timestamp: Date.now(),
      error: errorMessage,
    };
  }
}

/**
 * Validates that DB is available before processing requests
 * Should be used in middleware to prevent cascading failures
 */
export async function validateDBConnection(): Promise<boolean> {
  try {
    const health = await checkDBHealth();
    return health.connected;
  } catch {
    return false;
  }
}

/**
 * Gets detailed health info including connection pool status if available
 */
export async function getDetailedDBHealth(): Promise<DBHealthStatus & { message?: string }> {
  const health = await checkDBHealth();
  
  const messages: Record<string, string> = {
    healthy: "Database connection is healthy and responsive",
    degraded: "Database connection is slow or experiencing latency",
    unavailable: "Database connection is unavailable; requests will fail",
  };
  
  return {
    ...health,
    message: messages[health.status] || "Unknown database status",
  };
}
