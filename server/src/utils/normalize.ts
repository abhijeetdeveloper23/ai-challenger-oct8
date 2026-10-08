/**
 * Normalization helpers for stable business identity comparison.
 */

export function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    // Collapse dotted/spaced initials: "a.b.c" / "a b c dental" → "abc dental"
    .replace(/\b([a-z])(?:[.\s]+([a-z]))+\b/g, (match) => match.replace(/[.\s]+/g, ""))
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(llc|inc|ltd|co|corp|company|clinic|pc|pllc)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return undefined;
  // Keep last 10 digits for comparison (handles country codes)
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeWebsite(website?: string | null): string | undefined {
  if (!website) return undefined;
  let url = website.trim().toLowerCase();
  if (!url) return undefined;

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    // Strip tracking params
    const tracking = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "ref",
    ];
    tracking.forEach((p) => parsed.searchParams.delete(p));

    let path = parsed.pathname.replace(/\/+$/, "") || "";
    const search = parsed.searchParams.toString();
    const host = parsed.hostname.replace(/^www\./, "");
    return `https://${host}${path}${search ? `?${search}` : ""}`;
  } catch {
    return url.replace(/\/+$/, "").replace(/^www\./, "");
  }
}

export function normalizeAddress(address?: {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}): string {
  if (!address) return "";
  return [address.street, address.city, address.state, address.postalCode, address.country]
    .filter(Boolean)
    .map((p) =>
      String(p)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .join("|");
}

export function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizeLocation(location: string): string {
  return location.toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildCacheKey(
  query: string,
  location: string,
  product?: string | null
): string {
  const productPart = product?.trim()
    ? `::${normalizeQuery(product)}`
    : "";
  return `${normalizeQuery(query)}::${normalizeLocation(location)}${productPart}`;
}
