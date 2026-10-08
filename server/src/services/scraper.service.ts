import type { BusinessCandidate, WebsiteAnalysis } from "../types/index.js";
import { analyzeWebsite, getCachedAnalysis } from "./website.service.js";
import { normalizeWebsite } from "../utils/normalize.js";
import { log } from "../utils/logger.js";

export interface EnrichedBusiness extends BusinessCandidate {
  websiteAnalysis?: WebsiteAnalysis;
  analysisFailed?: boolean;
}

/**
 * Enrich businesses with website analysis.
 * Deduplicates website fetches; soft-fails per lead.
 */
export async function enrichWithWebsiteAnalysis(
  businesses: BusinessCandidate[],
  concurrency = 3
): Promise<{ enriched: EnrichedBusiness[]; failed: number }> {
  let failed = 0;
  const enriched: EnrichedBusiness[] = new Array(businesses.length);
  let index = 0;

  async function worker() {
    while (index < businesses.length) {
      const i = index++;
      const biz = businesses[i];
      try {
        if (!biz.website) {
          enriched[i] = {
            ...biz,
            websiteAnalysis: {
              exists: false,
              reachable: false,
              analyzedAt: new Date(),
            },
          };
          continue;
        }

        const key = normalizeWebsite(biz.website) || biz.website;
        const cached = getCachedAnalysis(key);
        const analysis = cached ?? (await analyzeWebsite(biz.website));

        enriched[i] = { ...biz, websiteAnalysis: analysis };
      } catch (err) {
        failed += 1;
        log.exception("scraper", `Website enrich failed for "${biz.name}"`, err, {
          website: biz.website,
        });
        enriched[i] = {
          ...biz,
          analysisFailed: true,
          websiteAnalysis: {
            exists: Boolean(biz.website),
            reachable: false,
            analyzedAt: new Date(),
          },
        };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, businesses.length)) },
    () => worker()
  );
  await Promise.all(workers);

  return { enriched, failed };
}
