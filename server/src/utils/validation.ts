import { z } from "zod";

export const searchSchema = z.object({
  query: z.string().trim().min(2, "query must be at least 2 characters"),
  location: z.string().trim().min(2, "location must be at least 2 characters"),
  /** Optional seller offer — biases scoring / pitch, not required for discovery */
  product: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v.length >= 2 ? v : undefined)),
});

export const leadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxScore: z.coerce.number().min(0).max(100).optional(),
  priority: z.string().optional(),
  city: z.string().optional(),
  category: z.string().optional(),
  hasWebsite: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  hasPhone: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  hasEmail: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  opportunity: z.string().optional(),
  searchId: z.string().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z
    .enum(["score", "reviews", "rating", "name", "revenue"])
    .optional()
    .default("score"),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

/** Batch owner enrichment — mirrors SaaSQuatch "Get Owner Details" (max 25). */
export const enrichOwnersSchema = z.object({
  leadIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one company")
    .max(25, "Maximum 25 companies per enrichment run"),
});
