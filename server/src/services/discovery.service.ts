import { env, hasLiveDiscoveryKeys } from "../config/env.js";
import type { BusinessCandidate } from "../types/index.js";
import type { BusinessDiscoveryProvider } from "../providers/BusinessDiscoveryProvider.js";
import { DemoDiscoveryProvider } from "../providers/DemoDiscoveryProvider.js";
import { SerpApiDiscoveryProvider } from "../providers/SerpApiDiscoveryProvider.js";
import { GooglePlacesDiscoveryProvider } from "../providers/GooglePlacesDiscoveryProvider.js";
import { FoursquareDiscoveryProvider } from "../providers/FoursquareDiscoveryProvider.js";
import { deduplicateBusinesses } from "./deduplication.service.js";
import { log } from "../utils/logger.js";
import { buildDiscoveryQuery } from "../utils/productIntent.js";

export interface DiscoveryResult {
  businesses: BusinessCandidate[];
  providers: string[];
  failedProviders: { name: string; error: string }[];
  /** Per-source raw counts before merge */
  sourceCounts: Record<string, number>;
  isDemo: boolean;
}

function parseProviderList(): string[] {
  if (env.DISCOVERY_PROVIDERS.trim()) {
    return env.DISCOVERY_PROVIDERS.split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
  }

  const single = (env.DISCOVERY_PROVIDER || "demo").toLowerCase();
  if (single === "multi" || single === "all") {
    return ["serpapi", "google_places", "foursquare"];
  }
  return [single];
}

function buildLiveProviders(names: string[]): BusinessDiscoveryProvider[] {
  const providers: BusinessDiscoveryProvider[] = [];
  const seen = new Set<string>();

  const add = (p: BusinessDiscoveryProvider) => {
    if (!seen.has(p.name)) {
      seen.add(p.name);
      providers.push(p);
    }
  };

  for (const name of names) {
    if (name === "serpapi" && env.DISCOVERY_API_KEY) {
      add(new SerpApiDiscoveryProvider());
    }
    if (
      (name === "google_places" || name === "google" || name === "places") &&
      env.GOOGLE_PLACES_API_KEY
    ) {
      add(new GooglePlacesDiscoveryProvider());
    }
    if ((name === "foursquare" || name === "fsq") && env.FOURSQUARE_API_KEY) {
      add(new FoursquareDiscoveryProvider());
    }
  }

  if (providers.length === 0 && hasLiveDiscoveryKeys()) {
    if (env.DISCOVERY_API_KEY) add(new SerpApiDiscoveryProvider());
    if (env.GOOGLE_PLACES_API_KEY) add(new GooglePlacesDiscoveryProvider());
    if (env.FOURSQUARE_API_KEY) add(new FoursquareDiscoveryProvider());
  }

  return providers;
}

function sampleNames(businesses: BusinessCandidate[], limit = 5): string[] {
  return businesses.slice(0, limit).map((b) => b.name);
}

function countBySource(businesses: BusinessCandidate[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of businesses) {
    const key = b.source || "unknown";
    // Merged sources look like "serpapi+foursquare"
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function fromDemo(
  query: string,
  location: string,
  failedProviders: { name: string; error: string }[] = []
): Promise<DiscoveryResult> {
  log.info(
    "discovery",
    `Using demo dataset for "${query}" @ "${location}"`,
    failedProviders.length
      ? { reason: "fallback", failedProviders }
      : { reason: "demo_mode" }
  );

  const demo = new DemoDiscoveryProvider();
  const businesses = await demo.searchBusinesses(query, location);
  const sourceCounts = { demo: businesses.length };

  log.info("discovery", `demo → ${businesses.length} businesses`, {
    samples: sampleNames(businesses),
  });

  return {
    businesses,
    providers: [demo.name],
    failedProviders,
    sourceCounts,
    isDemo: true,
  };
}

/**
 * Multi-source discovery with per-provider response logging.
 */
export async function discoverBusinesses(
  query: string,
  location: string,
  product?: string | null
): Promise<DiscoveryResult> {
  const discoveryQuery = buildDiscoveryQuery(query, product);

  if (env.DEMO_MODE) {
    return fromDemo(query, location);
  }

  const requested = parseProviderList();
  if (requested.length === 1 && requested[0] === "demo") {
    return fromDemo(query, location);
  }

  const live = buildLiveProviders(requested);

  if (live.length === 0) {
    log.warn("discovery", "No live providers configured — falling back to demo");
    return fromDemo(query, location, [
      { name: "live", error: "No live discovery API keys configured" },
    ]);
  }

  log.info("discovery", `Starting multi-source search`, {
    query,
    discoveryQuery,
    location,
    product: product || null,
    providers: live.map((p) => p.name),
    requested,
  });

  const failedProviders: { name: string; error: string }[] = [];
  const providersUsed: string[] = [];
  const batches: BusinessCandidate[][] = [];
  const sourceCounts: Record<string, number> = {};

  const settled = await Promise.allSettled(
    live.map(async (provider) => {
      const started = Date.now();
      log.info("discovery", `[${provider.name}] requesting…`, {
        discoveryQuery,
      });
      try {
        const results = await provider.searchBusinesses(
          discoveryQuery,
          location
        );
        const ms = Date.now() - started;
        log.info(
          "discovery",
          `[${provider.name}] OK — ${results.length} businesses in ${ms}ms`,
          {
            count: results.length,
            samples: sampleNames(results),
          }
        );
        return { name: provider.name, results, ms };
      } catch (err) {
        const ms = Date.now() - started;
        log.exception(
          "discovery",
          `[${provider.name}] FAILED after ${ms}ms`,
          err,
          { query: discoveryQuery, location, product }
        );
        throw err;
      }
    })
  );

  settled.forEach((outcome, i) => {
    const name = live[i].name;
    if (outcome.status === "fulfilled") {
      providersUsed.push(name);
      batches.push(outcome.value.results);
      sourceCounts[name] = outcome.value.results.length;
    } else {
      const error =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : "Provider failed";
      failedProviders.push({ name, error });
      sourceCounts[name] = 0;
    }
  });

  const rawTotal = batches.reduce((sum, b) => sum + b.length, 0);
  const merged = deduplicateBusinesses(batches.flat());
  const afterSourceMix = countBySource(merged);

  log.info("discovery", "Merge summary", {
    perSourceRaw: sourceCounts,
    rawTotal,
    afterDedupe: merged.length,
    duplicatesRemoved: Math.max(0, rawTotal - merged.length),
    afterDedupeBySourceLabel: afterSourceMix,
    failedProviders,
  });

  if (merged.length > 0) {
    log.info(
      "discovery",
      `Live discovery complete — ${merged.length} unique leads from [${providersUsed.join(", ")}]`
    );
    return {
      businesses: merged,
      providers: providersUsed,
      failedProviders,
      sourceCounts,
      isDemo: false,
    };
  }

  log.warn(
    "discovery",
    "All live providers returned 0 usable businesses — falling back to demo",
    { sourceCounts, failedProviders }
  );

  return fromDemo(query, location, [
    ...failedProviders,
    ...(providersUsed.length
      ? [{ name: "live", error: "Live providers returned no businesses" }]
      : []),
  ]);
}
