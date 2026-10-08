import type {
  BusinessCandidate,
  ScoredLeadResult,
  WebsiteAnalysis,
} from "../types/index.js";
import { applyProductBias } from "../utils/productIntent.js";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function hasStrongActivity(rating?: number, reviewCount?: number): boolean {
  return (reviewCount ?? 0) >= 50 || ((rating ?? 0) >= 4.5 && (reviewCount ?? 0) >= 20);
}

function hasWeakDigital(analysis?: WebsiteAnalysis, website?: string): boolean {
  if (!website) return true;
  if (!analysis) return true;
  if (!analysis.reachable) return true;
  if (analysis.https === false) return true;
  if (!analysis.hasBooking && !analysis.hasContactForm) return true;
  return false;
}

/**
 * Deterministic, explainable lead scoring (max 100).
 * LLM is never used for the numeric score.
 * Optional `product` is the seller's offer — used only to bias gaps/pitch, not invent facts.
 */
export function scoreLead(
  business: BusinessCandidate,
  analysis?: WebsiteAnalysis,
  product?: string | null
): ScoredLeadResult {
  const reasons: string[] = [];
  const opportunities: string[] = [];

  // --- Business Activity (30) ---
  let businessActivity = 0;
  const reviews = business.reviewCount ?? 0;
  const rating = business.rating ?? 0;

  if (reviews >= 100) {
    businessActivity += 20;
    reasons.push(`${reviews} customer reviews`);
    opportunities.push("High review count");
  } else if (reviews >= 50) {
    businessActivity += 15;
    reasons.push(`${reviews} customer reviews`);
    opportunities.push("Strong customer activity");
  } else if (reviews >= 20) {
    businessActivity += 10;
    reasons.push(`${reviews} customer reviews`);
  } else if (reviews >= 5) {
    businessActivity += 5;
    reasons.push(`${reviews} customer reviews`);
  }

  if (rating >= 4.5) {
    businessActivity += 10;
    reasons.push(`${rating} rating`);
    opportunities.push("High rating");
  } else if (rating >= 4.0) {
    businessActivity += 5;
    reasons.push(`${rating} rating`);
  } else if (rating > 0) {
    reasons.push(`${rating} rating`);
  }

  businessActivity = clamp(businessActivity, 0, 30);
  if (hasStrongActivity(rating, reviews)) {
    if (!opportunities.includes("Strong customer activity") && !opportunities.includes("High review count")) {
      opportunities.push("Strong customer activity");
    }
  }

  // --- Contactability (20) ---
  let contactability = 0;
  if (business.phone) {
    contactability += 10;
    reasons.push("Phone number available");
  } else {
    opportunities.push("No phone detected");
  }

  const emailFromBiz = business.email;
  const emailFromSite = analysis?.hasEmail;
  if (emailFromBiz || emailFromSite) {
    contactability += 10;
    reasons.push("Email available");
  } else {
    opportunities.push("No email detected");
  }
  contactability = clamp(contactability, 0, 20);

  // --- Digital Opportunity (30) ---
  let digitalOpportunity = 0;
  const hasWebsite = Boolean(business.website);

  if (!hasWebsite) {
    digitalOpportunity += 25;
    reasons.push("No website detected");
    opportunities.push("No website");
  } else if (analysis && !analysis.reachable) {
    digitalOpportunity += 20;
    reasons.push("Website unavailable");
    opportunities.push("Website unavailable");
  } else if (analysis && analysis.https === false) {
    digitalOpportunity += 10;
    reasons.push("Website not using HTTPS");
    opportunities.push("Website not using HTTPS");
  } else if (hasWebsite && analysis?.reachable) {
    reasons.push("Website detected");
  }

  if (hasWebsite && analysis?.reachable && analysis.https === false) {
    opportunities.push("Poor website signals");
  }

  digitalOpportunity = clamp(digitalOpportunity, 0, 30);

  // --- Conversion Opportunity (20) ---
  let conversionOpportunity = 0;
  const noBooking = !hasWebsite || !analysis?.reachable || analysis?.hasBooking === false;
  const noForm = !hasWebsite || !analysis?.reachable || analysis?.hasContactForm === false;

  if (!hasWebsite || (analysis && !analysis.reachable)) {
    conversionOpportunity += 15;
    reasons.push("No online booking detected");
    opportunities.push("No online booking");
    conversionOpportunity += 5;
    opportunities.push("No contact form");
  } else {
    if (analysis?.hasBooking === false) {
      conversionOpportunity += 15;
      reasons.push("No online booking detected");
      opportunities.push("No online booking");
    } else if (analysis?.hasBooking) {
      reasons.push("Online booking detected");
    }

    if (analysis?.hasContactForm === false) {
      conversionOpportunity += 5;
      reasons.push("No contact form detected");
      opportunities.push("No contact form");
    } else if (analysis?.hasContactForm) {
      reasons.push("Contact form detected");
    }
  }

  conversionOpportunity = clamp(conversionOpportunity, 0, 20);

  if (hasStrongActivity(rating, reviews) && hasWeakDigital(analysis, business.website)) {
    opportunities.push("Strong business presence but weak digital presence");
  }

  let primaryOpportunity = resolvePrimaryOpportunity(
    business,
    analysis,
    opportunities,
    reviews,
    rating
  );

  const biased = applyProductBias({
    product,
    website: business.website,
    analysis,
    opportunities,
    primaryOpportunity,
    digitalOpportunity,
    conversionOpportunity,
    scoreReasons: reasons,
  });

  digitalOpportunity = clamp(biased.digitalOpportunity, 0, 30);
  conversionOpportunity = clamp(biased.conversionOpportunity, 0, 20);
  primaryOpportunity = biased.primaryOpportunity;

  const leadScore = clamp(
    businessActivity + contactability + digitalOpportunity + conversionOpportunity,
    0,
    100
  );

  return {
    leadScore,
    scoreBreakdown: {
      businessActivity,
      contactability,
      digitalOpportunity,
      conversionOpportunity,
    },
    scoreReasons: biased.scoreReasons,
    opportunities: biased.opportunities,
    primaryOpportunity,
  };
}

function resolvePrimaryOpportunity(
  business: BusinessCandidate,
  analysis: WebsiteAnalysis | undefined,
  opportunities: string[],
  reviews: number,
  rating: number
): string {
  const noWebsite = !business.website;
  const highActivity = hasStrongActivity(rating, reviews);
  const reachable = analysis?.reachable === true;
  const hasBooking = analysis?.hasBooking === true;
  const weakDigital = hasWeakDigital(analysis, business.website);

  if (noWebsite && highActivity) {
    return "Website development opportunity";
  }

  if (noWebsite) {
    return "Website + online booking";
  }

  if (business.website && !reachable) {
    return "Website reliability opportunity";
  }

  if (business.website && reachable && !hasBooking) {
    return "Online booking opportunity";
  }

  if (business.website && reachable && (analysis?.https === false || (!analysis?.hasContactForm && !hasBooking))) {
    return "Website optimization opportunity";
  }

  if (highActivity && weakDigital) {
    return "Digital growth opportunity";
  }

  if (opportunities.includes("No online booking")) {
    return "Online booking opportunity";
  }

  if (opportunities.length > 0) {
    return opportunities[0];
  }

  return "Relationship / retention opportunity";
}
