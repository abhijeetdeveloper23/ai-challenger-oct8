import axios from "axios";
import { env } from "../config/env.js";
import type { BusinessCandidate } from "../types/index.js";
import type { BusinessDiscoveryProvider } from "./BusinessDiscoveryProvider.js";
import { AppError } from "../utils/AppError.js";
import { log } from "../utils/logger.js";

/**
 * Optional SerpAPI Google Local provider.
 * Only used when DISCOVERY_API_KEY is set and DEMO_MODE is false.
 * Respects rate limits; does not bypass CAPTCHA or anti-bot protections.
 */
export class SerpApiDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly name = "serpapi";

  async searchBusinesses(
    query: string,
    location: string
  ): Promise<BusinessCandidate[]> {
    if (!env.DISCOVERY_API_KEY) {
      throw new AppError("Discovery API key is not configured", 503);
    }

    try {
      const response = await axios.get("https://serpapi.com/search.json", {
        timeout: 15_000,
        params: {
          engine: "google_maps",
          q: `${query} ${location}`,
          type: "search",
          api_key: env.DISCOVERY_API_KEY,
        },
      });

      const results = response.data?.local_results || [];
      return results.map(
        (item: {
          title?: string;
          type?: string;
          address?: string;
          phone?: string;
          website?: string;
          rating?: number;
          reviews?: number;
          place_id?: string;
        }): BusinessCandidate => {
          const cityGuess = location.split(",")[0]?.trim();
          return {
            name: item.title || "Unknown",
            category: item.type || query,
            address: {
              street: item.address,
              city: cityGuess,
              country: "Unknown",
            },
            phone: item.phone,
            website: item.website,
            rating: item.rating,
            reviewCount: item.reviews,
            source: "serpapi",
            sourceId: item.place_id,
          };
        }
      );
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.status === 429
          ? "Discovery API rate limit exceeded"
          : "Discovery API request failed";
      log.exception("serpapi", message, err, { query, location });
      throw new AppError(message, 502, {
        provider: this.name,
      });
    }
  }
}
