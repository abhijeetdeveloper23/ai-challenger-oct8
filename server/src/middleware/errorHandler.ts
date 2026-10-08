import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";
import { log } from "../utils/logger.js";

export function notFoundHandler(req: Request, res: Response): void {
  log.warn("http", `404 Not found — ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const path = `${req.method} ${req.originalUrl}`;

  if (err instanceof ZodError) {
    log.warn("http", `Validation failed — ${path}`, {
      fieldErrors: err.flatten().fieldErrors,
    });
    res.status(400).json({
      error: "Invalid request",
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof AppError) {
    const level = err.statusCode >= 500 ? "error" : "warn";
    log[level]("http", `AppError ${err.statusCode} — ${path}: ${err.message}`, {
      details: err.details,
    });
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  log.exception("http", `Unhandled exception — ${path}`, err);

  const message =
    env.NODE_ENV === "production"
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "Internal server error";

  res.status(500).json({ error: message });
}
