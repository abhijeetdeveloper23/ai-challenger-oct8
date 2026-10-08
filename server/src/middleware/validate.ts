import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

type RequestPart = "body" | "query" | "params";

export function validate(schema: ZodSchema, part: RequestPart = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req[part]);
    // Express 4: req.query is a getter-only property — assign fields carefully
    if (part === "body") {
      req.body = parsed;
    } else if (part === "query") {
      Object.assign(req.query, parsed);
    } else {
      Object.assign(req.params, parsed);
    }
    next();
  };
}
