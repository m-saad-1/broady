import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

/**
 * Central Error Handler with DB Connection Recovery
 * 
 * Catches all errors and maps Prisma errors to appropriate HTTP responses.
 * Ensures application remains stable even when DB connection issues occur.
 * 
 * AUTO-VERIFY: When this handler triggers, DB connectivity is automatically
 * checked on the next request via middleware/health endpoint.
 */
export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction) {
  void next;
  
  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error("[db] initialization error", { message: error.message });
    return res.status(503).json({ 
      message: "Database is temporarily unavailable. Please retry in a moment.", 
      code: "DB_INITIALIZATION_ERROR" 
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("[db] known request error", { code: error.code, message: error.message });

    // Connection-related errors
    if (error.code === "P1001" || error.code === "P1002" || error.code === "P2024") {
      return res.status(503).json({ 
        message: "Database connection is unstable. Please retry the request.", 
        code: error.code 
      });
    }

    // Validation errors
    if (error.code === "P2000" || error.code === "P2006") {
      return res.status(400).json({ 
        message: "Invalid input for database operation", 
        code: error.code 
      });
    }

    // Record not found
    if (error.code === "P2025") {
      return res.status(404).json({ 
        message: "Resource not found", 
        code: error.code 
      });
    }

    return res.status(400).json({ message: error.message, code: error.code });
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    console.error("[db] rust panic", { message: error.message });
    return res.status(503).json({ 
      message: "Database engine restarted unexpectedly. Please retry.", 
      code: "DB_ENGINE_RESTARTED" 
    });
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    console.error("[db] validation error", { message: error.message });
    return res.status(400).json({ 
      message: "Invalid database query parameters", 
      code: "DB_VALIDATION_ERROR" 
    });
  }

  console.error("[error] unhandled error", { 
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  return res.status(500).json({ message: "Internal server error" });
}
