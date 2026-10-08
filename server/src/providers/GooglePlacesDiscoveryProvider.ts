import axios from "axios";
import { env } from "../config/env.js";
import type { BusinessCandidate } from "../types/index.js";
import type { BusinessDiscoveryProvider } from "./BusinessDiscoveryProvider.js";
import { AppError } from "../utils/AppError.js";
import { log } from "../utils/logger.js";

/**
 * Official Google Places API (New) — Text Search.
 * Used as a second discovery source alongside SerpAPI.
 */
export class GooglePlacesDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly name = "google_places";

  async searchBusinesses(
    query: string,
    location: string
  ): Promise<BusinessCandidate[]> {
    if (!env.GOOGLE_PLACES_API_KEY) {
      throw new AppError("Google Places API key is not configured", 503);
    }

    try {
      const response = await axios.post(
        "https://places.googleapis.com/v1/places:searchText",
        {
          textQuery: `${query} in ${location}`,
          pageSize: 20,
        },
        {
          timeout: 15_000,
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": [
              "places.id",
              "places.displayName",
              "places.formattedAddress",
              "places.nationalPhoneNumber",
              "places.internationalPhoneNumber",
              "places.websiteUri",
              "places.rating",
              "places.userRatingCount",
              "places.types",
              "places.primaryTypeDisplayName",
            ].join(","),
          },
        }
      );

      const places = response.data?.places || [];
      const cityGuess = location.split(",")[0]?.trim();

      return places.map(
        (place: {
          id?: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          nationalPhoneNumber?: string;
          internationalPhoneNumber?: string;
          websiteUri?: string;
          rating?: number;
          userRatingCount?: number;
          types?: string[];
          primaryTypeDisplayName?: { text?: string };
        }): BusinessCandidate => ({
          name: place.displayName?.text || "Unknown",
          category:
            place.primaryTypeDisplayName?.text ||
            place.types?.[0]?.replace(/_/g, " ") ||
            query,
          address: {
            street: place.formattedAddress,
            city: cityGuess,
            country: "Unknown",
          },
          phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
          website: place.websiteUri,
          rating: place.rating,
          reviewCount: place.userRatingCount,
          source: "google_places",
          sourceId: place.id,
        })
      );
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.status === 429
          ? "Google Places rate limit exceeded"
          : "Google Places request failed";
      log.exception("google_places", message, err, { query, location });
      throw new AppError(message, 502, { provider: this.name });
    }
  }
}
