import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /**
   * Frontend origin(s) for CORS. Comma-separated allowed.
   * Use origin only — no trailing slash (browsers never send one).
   * Example: https://ai-challenger-oct8-z14n.vercel.app
   */
  CLIENT_URL: z
    .string()
    .default("http://localhost:5173")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim().replace(/\/+$/, ""))
        .filter(Boolean)
        .join(",")
    ),
  MONGODB_URI: z.string().min(1),
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  DISCOVERY_API_KEY: z.string().optional().default(""),
  GOOGLE_PLACES_API_KEY: z.string().optional().default(""),
  FOURSQUARE_API_KEY: z.string().optional().default(""),
  /** Comma-separated: serpapi,google_places,foursquare — or single DISCOVERY_PROVIDER */
  DISCOVERY_PROVIDERS: z.string().optional().default(""),
  DISCOVERY_PROVIDER: z.string().optional().default("demo"),
  WEBSITE_TIMEOUT_MS: z.coerce.number().default(5000),
  WEBSITE_CONCURRENCY: z.coerce.number().default(3),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().optional().default("gpt-4o-mini"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export function hasLiveDiscoveryKeys(): boolean {
  return Boolean(
    env.DISCOVERY_API_KEY || env.GOOGLE_PLACES_API_KEY || env.FOURSQUARE_API_KEY
  );
}

/** Explicit demo mode, or no live keys configured */
export const isDemoMode = env.DEMO_MODE || !hasLiveDiscoveryKeys();
