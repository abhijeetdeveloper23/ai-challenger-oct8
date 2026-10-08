import type { BusinessCandidate } from "../types/index.js";
import {
  normalizeBusinessName,
  normalizePhone,
  normalizeWebsite,
  normalizeAddress,
} from "../utils/normalize.js";

function richness(b: BusinessCandidate): number {
  let score = 0;
  if (b.phone) score += 2;
  if (b.website) score += 2;
  if (b.email) score += 1;
  if (b.rating != null) score += 1;
  if ((b.reviewCount ?? 0) > 0) score += 1;
  if (b.address?.street) score += 1;
  return score;
}

function mergePreferRicher(
  a: BusinessCandidate,
  b: BusinessCandidate
): BusinessCandidate {
  const primary = richness(a) >= richness(b) ? a : b;
  const secondary = primary === a ? b : a;
  return {
    ...secondary,
    ...primary,
    phone: primary.phone || secondary.phone,
    email: primary.email || secondary.email,
    website: primary.website || secondary.website,
    rating: primary.rating ?? secondary.rating,
    reviewCount: Math.max(primary.reviewCount ?? 0, secondary.reviewCount ?? 0),
    category: primary.category || secondary.category,
    address: primary.address?.street ? primary.address : secondary.address || primary.address,
    // Keep both source hints when merged across providers
    source: primary.source !== secondary.source
      ? `${primary.source}+${secondary.source}`
      : primary.source,
    sourceId: primary.sourceId || secondary.sourceId,
  };
}

/**
 * Deduplicate by priority:
 * 1. Same source ID
 * 2. Same normalized website
 * 3. Same normalized phone
 * 4. Same normalized name + address
 *
 * When duplicates come from multiple providers, keep the richer record.
 */
export function deduplicateBusinesses(
  businesses: BusinessCandidate[]
): BusinessCandidate[] {
  const bySourceId = new Map<string, number>();
  const byWebsite = new Map<string, number>();
  const byPhone = new Map<string, number>();
  const byNameAddress = new Map<string, number>();
  const result: BusinessCandidate[] = [];

  function findExistingIndex(biz: BusinessCandidate): number {
    const sourceKey =
      biz.source && biz.sourceId
        ? `${biz.source.split("+")[0]}:${biz.sourceId}`
        : null;
    // Also match bare sourceId across providers when present
    if (biz.sourceId) {
      for (const [key, idx] of bySourceId) {
        if (key.endsWith(`:${biz.sourceId}`)) return idx;
      }
    }
    if (sourceKey && bySourceId.has(sourceKey)) return bySourceId.get(sourceKey)!;

    const websiteKey = normalizeWebsite(biz.website);
    if (websiteKey && byWebsite.has(websiteKey)) return byWebsite.get(websiteKey)!;

    const phoneKey = normalizePhone(biz.phone);
    if (phoneKey && byPhone.has(phoneKey)) return byPhone.get(phoneKey)!;

    const nameAddressKey = `${normalizeBusinessName(biz.name)}|${normalizeAddress(biz.address)}`;
    if (nameAddressKey !== "|" && byNameAddress.has(nameAddressKey)) {
      return byNameAddress.get(nameAddressKey)!;
    }

    return -1;
  }

  function indexKeys(biz: BusinessCandidate, idx: number) {
    if (biz.source && biz.sourceId) {
      bySourceId.set(`${biz.source.split("+")[0]}:${biz.sourceId}`, idx);
    }
    if (biz.sourceId) {
      bySourceId.set(`id:${biz.sourceId}`, idx);
    }
    const websiteKey = normalizeWebsite(biz.website);
    if (websiteKey) byWebsite.set(websiteKey, idx);
    const phoneKey = normalizePhone(biz.phone);
    if (phoneKey) byPhone.set(phoneKey, idx);
    const nameAddressKey = `${normalizeBusinessName(biz.name)}|${normalizeAddress(biz.address)}`;
    if (nameAddressKey !== "|") byNameAddress.set(nameAddressKey, idx);
  }

  for (const biz of businesses) {
    const existing = findExistingIndex(biz);
    if (existing >= 0) {
      result[existing] = mergePreferRicher(result[existing], biz);
      indexKeys(result[existing], existing);
      continue;
    }
    const idx = result.length;
    result.push(biz);
    indexKeys(biz, idx);
  }

  return result;
}
