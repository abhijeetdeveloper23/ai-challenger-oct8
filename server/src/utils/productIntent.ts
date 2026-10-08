import type { WebsiteAnalysis } from "../types/index.js";

export type ProductIntent =
  | "website"
  | "booking"
  | "marketing"
  | "crm"
  | "general";

/** Map the seller's optional product/offer to an intent bucket. */
export function detectProductIntent(product?: string | null): ProductIntent {
  if (!product?.trim()) return "general";
  const p = product.toLowerCase();

  if (
    /website|web\s*design|web\s*dev|landing\s*page|wordpress|web\s*site/.test(p)
  ) {
    return "website";
  }
  if (
    /book(ing)?|appointment|schedul|reservation|calendly|online\s*booking/.test(p)
  ) {
    return "booking";
  }
  if (
    /seo|marketing|ads|google\s*ads|social\s*media|digital\s*growth|branding/.test(
      p
    )
  ) {
    return "marketing";
  }
  if (/crm|saas|software|automation|chatbot|email\s*market/.test(p)) {
    return "crm";
  }
  return "general";
}

export interface ProductBiasInput {
  product?: string | null;
  website?: string;
  analysis?: WebsiteAnalysis;
  opportunities: string[];
  primaryOpportunity: string;
  digitalOpportunity: number;
  conversionOpportunity: number;
  scoreReasons: string[];
}

export interface ProductBiasResult {
  digitalOpportunity: number;
  conversionOpportunity: number;
  opportunities: string[];
  primaryOpportunity: string;
  scoreReasons: string[];
  /** Extra points applied (for logging / explainability) */
  boostApplied: number;
}

/**
 * Bias scoring toward gaps that match what the salesperson wants to sell.
 * Does not invent facts — only reweights existing digital/conversion gaps.
 */
export function applyProductBias(input: ProductBiasInput): ProductBiasResult {
  const intent = detectProductIntent(input.product);
  let digital = input.digitalOpportunity;
  let conversion = input.conversionOpportunity;
  const opportunities = [...input.opportunities];
  const scoreReasons = [...input.scoreReasons];
  let primary = input.primaryOpportunity;
  let boost = 0;

  if (intent === "general" || !input.product?.trim()) {
    return {
      digitalOpportunity: digital,
      conversionOpportunity: conversion,
      opportunities,
      primaryOpportunity: primary,
      scoreReasons,
      boostApplied: 0,
    };
  }

  const offer = input.product.trim();
  const noWebsite = !input.website;
  const unreachable = Boolean(input.website && input.analysis && !input.analysis.reachable);
  const noBooking =
    noWebsite ||
    unreachable ||
    input.analysis?.hasBooking === false;
  const weakDigital =
    noWebsite ||
    unreachable ||
    input.analysis?.https === false ||
    (!input.analysis?.hasBooking && !input.analysis?.hasContactForm);

  if (intent === "website" && (noWebsite || unreachable)) {
    const add = Math.min(5, 30 - digital);
    digital += add;
    boost += add;
    primary = noWebsite
      ? "Website development opportunity"
      : "Website reliability opportunity";
    scoreReasons.push(`Fits your offer: ${offer}`);
    if (!opportunities.includes("Aligned with your product offer")) {
      opportunities.unshift("Aligned with your product offer");
    }
  } else if (intent === "booking" && noBooking) {
    const add = Math.min(5, 20 - conversion);
    conversion += add;
    boost += add;
    primary = "Online booking opportunity";
    scoreReasons.push(`Fits your offer: ${offer}`);
    if (!opportunities.includes("Aligned with your product offer")) {
      opportunities.unshift("Aligned with your product offer");
    }
  } else if (intent === "marketing" && weakDigital) {
    const add = Math.min(4, 30 - digital);
    digital += add;
    boost += add;
    primary = "Digital growth opportunity";
    scoreReasons.push(`Fits your offer: ${offer}`);
    if (!opportunities.includes("Aligned with your product offer")) {
      opportunities.unshift("Aligned with your product offer");
    }
  } else if (intent === "crm") {
    // Prefer businesses that are contactable but digitally weak
    if (weakDigital) {
      const add = Math.min(3, 30 - digital);
      digital += add;
      boost += add;
    }
    primary = primary || "Digital growth opportunity";
    scoreReasons.push(`Fits your offer: ${offer}`);
    if (!opportunities.includes("Aligned with your product offer")) {
      opportunities.unshift("Aligned with your product offer");
    }
  } else {
    // Product set but lead doesn't match gap — still note the offer for UI context
    scoreReasons.push(`Seller offer considered: ${offer}`);
  }

  return {
    digitalOpportunity: digital,
    conversionOpportunity: conversion,
    opportunities: [...new Set(opportunities)],
    primaryOpportunity: primary,
    scoreReasons,
    boostApplied: boost,
  };
}

/**
 * Optional soft discovery query. Industry stays primary;
 * only append product when it looks like a local niche modifier (not a SaaS pitch).
 */
export function buildDiscoveryQuery(industry: string, product?: string | null): string {
  const base = industry.trim();
  if (!product?.trim()) return base;

  const intent = detectProductIntent(product);
  // SaaS-style offers should not pollute Maps queries ("dentist website development")
  if (intent !== "general") return base;

  return `${base} ${product.trim()}`;
}
