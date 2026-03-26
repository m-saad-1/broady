import type { NextFunction, Request, Response } from "express";

export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction) {
  void next;
  console.error(error);
  return res.status(500).json({ message: "Internal server error" });
}
