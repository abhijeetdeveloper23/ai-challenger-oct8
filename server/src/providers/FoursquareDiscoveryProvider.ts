import axios from "axios";
import { env } from "../config/env.js";
import type { BusinessCandidate } from "../types/index.js";
import type { BusinessDiscoveryProvider } from "./BusinessDiscoveryProvider.js";
import { AppError } from "../utils/AppError.js";
import { log } from "../utils/logger.js";

interface FsqPlace {
  fsq_place_id?: string;
  fsq_id?: string;
  name?: string;
  location?: {
    formatted_address?: string;
    address?: string;
    locality?: string;
    region?: string;
    postcode?: string;
    country?: string;
  };
  tel?: string;
  website?: string;
  email?: string;
  rating?: number;
  stats?: { total_ratings?: number; total_tips?: number };
  categories?: { name?: string }[];
}

const PLACES_API_VERSION = "2025-06-17";

/**
 * Foursquare Places API (new) — Place Search.
 * https://places-api.foursquare.com/places/search
 */
export class FoursquareDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly name = "foursquare";

  async searchBusinesses(
    query: string,
    location: string
  ): Promise<BusinessCandidate[]> {
    if (!env.FOURSQUARE_API_KEY) {
      throw new AppError("Foursquare API key is not configured", 503);
    }

    try {
      const response = await axios.get<{ results?: FsqPlace[] }>(
        "https://places-api.foursquare.com/places/search",
        {
          timeout: 15_000,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${env.FOURSQUARE_API_KEY}`,
            "X-Places-Api-Version": PLACES_API_VERSION,
          },
          params: {
            query,
            near: location,
            limit: 20,
          },
        }
      );

      const results = response.data?.results || [];

      return results.map((place): BusinessCandidate => {
        const city =
          place.location?.locality || location.split(",")[0]?.trim();
        const category = place.categories?.[0]?.name || query;

        // Foursquare ratings are sometimes 0–10; normalize to 0–5 for our scorer
        let rating = place.rating;
        if (typeof rating === "number" && rating > 5) {
          rating = Math.round((rating / 2) * 10) / 10;
        }

        const reviewCount =
          place.stats?.total_ratings ?? place.stats?.total_tips ?? undefined;

        return {
          name: place.name || "Unknown",
          category,
          address: {
            street:
              place.location?.formatted_address ||
              place.location?.address ||
              undefined,
            city,
            state: place.location?.region,
            country: place.location?.country,
            postalCode: place.location?.postcode,
          },
          phone: place.tel,
          email: place.email,
          website: place.website,
          rating,
          reviewCount,
          source: "foursquare",
          sourceId: place.fsq_place_id || place.fsq_id,
        };
      });
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const message =
        status === 401 || status === 403
          ? "Foursquare API key rejected"
          : status === 429
            ? "Foursquare rate limit exceeded"
            : "Foursquare Places request failed";
      log.exception("foursquare", message, err, { query, location, status });
      throw new AppError(message, 502, { provider: this.name });
    }
  }
}
