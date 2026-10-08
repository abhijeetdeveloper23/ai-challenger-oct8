import type { EstimatedRevenue, Lead } from "../types/lead";

/** Client fallback when older leads lack server-side estimatedRevenue. */
export function getRevenue(lead: Lead): EstimatedRevenue {
  if (lead.estimatedRevenue?.label) return lead.estimatedRevenue;

  const reviews = lead.reviewCount ?? 0;
  const rating = lead.rating ?? 0;
  if (reviews === 0 && !rating) {
    return {
      label: "Unknown",
      midpoint: 0,
      confidence: "low",
      basis: "Not enough public signals",
    };
  }

  let annual = reviews * 3200;
  if (rating >= 4.5) annual *= 1.15;
  else if (rating > 0 && rating < 3.5) annual *= 0.85;

  const cat = (lead.category || "").toLowerCase();
  if (cat.includes("dentist") || cat.includes("dental")) annual *= 1.6;
  else if (cat.includes("hospital")) annual *= 4;
  else if (cat.includes("gym") || cat.includes("fitness")) annual *= 1.2;
  else if (cat.includes("restaurant")) annual *= 1.1;

  annual = Math.max(40_000, Math.min(annual, 8_000_000));
  const spread = annual < 200_000 ? 0.45 : 0.35;
  const low = Math.round(annual * (1 - spread));
  const high = Math.round(annual * (1 + spread));
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : `$${Math.round(n / 1000)}K`;

  return {
    label: `${fmt(low)}–${fmt(high)}`,
    midpoint: Math.round((low + high) / 2),
    confidence: reviews >= 80 ? "high" : reviews >= 20 ? "medium" : "low",
    basis: `${reviews} reviews`,
  };
}

export const confidenceStyles: Record<
  EstimatedRevenue["confidence"],
  string
> = {
  high: "bg-success/15 text-success",
  medium: "bg-warm-soft text-high",
  low: "bg-low-bg text-low",
};
