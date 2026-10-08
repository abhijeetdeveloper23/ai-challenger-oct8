/**
 * Heuristic revenue band from public signals (reviews / rating / category).
 * Not accounting data — labeled with confidence for honesty in the UI.
 */

export type RevenueConfidence = "low" | "medium" | "high";

export interface RevenueEstimate {
  /** Human-readable band, e.g. "$250K–$500K" */
  label: string;
  /** Midpoint for sorting, USD */
  midpoint: number;
  confidence: RevenueConfidence;
  basis: string;
}

const CATEGORY_MULTIPLIER: Record<string, number> = {
  hospital: 4,
  clinic: 1.4,
  dentist: 1.6,
  dental: 1.6,
  orthodont: 1.8,
  veterinary: 1.3,
  gym: 1.2,
  fitness: 1.2,
  restaurant: 1.1,
  cafe: 0.9,
  hotel: 2.2,
  "real estate": 1.5,
  lawyer: 1.7,
  attorney: 1.7,
  software: 2.5,
  salon: 0.85,
  spa: 1.0,
  plumber: 1.1,
  electrician: 1.1,
};

function categoryMultiplier(category?: string): number {
  if (!category) return 1;
  const c = category.toLowerCase();
  for (const [key, mult] of Object.entries(CATEGORY_MULTIPLIER)) {
    if (c.includes(key)) return mult;
  }
  return 1;
}

function formatBand(low: number, high: number): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${Math.round(n)}`;
  };
  return `${fmt(low)}–${fmt(high)}`;
}

/**
 * Rough local-business revenue proxy:
 * base from review volume, adjusted by rating + industry.
 */
export function estimateRevenue(input: {
  reviewCount?: number;
  rating?: number;
  category?: string;
}): RevenueEstimate {
  const reviews = Math.max(0, input.reviewCount ?? 0);
  const rating = input.rating ?? 0;

  if (reviews === 0 && !rating) {
    return {
      label: "Unknown",
      midpoint: 0,
      confidence: "low",
      basis: "Not enough public activity signals",
    };
  }

  // ~$2.5k–$4k revenue signal per review as a crude local SMB proxy
  let annual = reviews * 3200;
  if (rating >= 4.5) annual *= 1.15;
  else if (rating > 0 && rating < 3.5) annual *= 0.85;

  annual *= categoryMultiplier(input.category);

  // Clamp to sensible SMB bands
  annual = Math.max(40_000, Math.min(annual, 8_000_000));

  const spread = annual < 200_000 ? 0.45 : annual < 1_000_000 ? 0.35 : 0.3;
  const low = Math.round(annual * (1 - spread));
  const high = Math.round(annual * (1 + spread));

  let confidence: RevenueConfidence = "low";
  if (reviews >= 80) confidence = "high";
  else if (reviews >= 20) confidence = "medium";

  return {
    label: formatBand(low, high),
    midpoint: Math.round((low + high) / 2),
    confidence,
    basis:
      reviews > 0
        ? `Based on ${reviews} reviews${rating ? `, ${rating}★` : ""}${
            input.category ? `, ${input.category}` : ""
          }`
        : "Limited public signals",
  };
}
