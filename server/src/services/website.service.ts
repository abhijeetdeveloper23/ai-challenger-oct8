import axios from "axios";
import * as cheerio from "cheerio";
import { env } from "../config/env.js";
import type { WebsiteAnalysis } from "../types/index.js";
import { normalizeWebsite } from "../utils/normalize.js";
import { log } from "../utils/logger.js";

const USER_AGENT =
  "LeadIntelligenceBot/1.0 (+https://github.com/lead-intelligence; research/demo)";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;

const BOOKING_TERMS = [
  "book",
  "booking",
  "appointment",
  "schedule",
  "reserve",
  "reservations",
  "book now",
  "book online",
];

const CONTACT_FORM_HINTS = [
  "contact form",
  "contact-us",
  "contactus",
  'type="submit"',
  "name=\"email\"",
  "name='email'",
  "get in touch",
];

const SOCIAL_HOSTS = ["facebook.com", "instagram.com", "linkedin.com", "youtube.com", "twitter.com", "x.com"];

/** In-memory cache so we never analyze the same website twice in one process/search. */
const analysisCache = new Map<string, WebsiteAnalysis>();

export function clearWebsiteCache(): void {
  analysisCache.clear();
}

export function invalidateWebsiteCache(website?: string | null): void {
  const key = website ? normalizeWebsite(website) : null;
  if (key) analysisCache.delete(key);
}

export function getCachedAnalysis(website: string): WebsiteAnalysis | undefined {
  const key = normalizeWebsite(website);
  return key ? analysisCache.get(key) : undefined;
}

export function setCachedAnalysis(website: string, analysis: WebsiteAnalysis): void {
  const key = normalizeWebsite(website);
  if (key) analysisCache.set(key, analysis);
}

/**
 * Lightweight homepage website analyzer.
 * Failures return a soft analysis object — never throw for the pipeline.
 */
export async function analyzeWebsite(website?: string | null): Promise<WebsiteAnalysis> {
  if (!website) {
    return {
      exists: false,
      reachable: false,
      analyzedAt: new Date(),
    };
  }

  const normalized = normalizeWebsite(website) ?? website;
  const cached = analysisCache.get(normalized);
  if (cached) return cached;

  const result = await fetchAndParse(normalized);
  analysisCache.set(normalized, result);
  return result;
}

async function fetchAndParse(url: string): Promise<WebsiteAnalysis> {
  const https = url.startsWith("https://");
  const base: WebsiteAnalysis = {
    exists: true,
    reachable: false,
    https,
    analyzedAt: new Date(),
  };

  try {
    const response = await axios.get(url, {
      timeout: env.WEBSITE_TIMEOUT_MS,
      maxRedirects: 3,
      validateStatus: () => true,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      responseType: "text",
    });

    base.statusCode = response.status;
    base.reachable = response.status >= 200 && response.status < 400;
    base.https = (response.request?.res?.responseUrl || url).startsWith("https://");

    if (!base.reachable || typeof response.data !== "string") {
      log.warn("website", `Unreachable or non-HTML — ${url}`, {
        statusCode: base.statusCode,
      });
      return base;
    }

    return parseHtml(response.data, base);
  } catch (err) {
    // Soft failure — website unreachable / timeout
    log.warn("website", `Analysis soft-fail — ${url}`, {
      message: err instanceof Error ? err.message : String(err),
      code: (err as { code?: string })?.code,
    });
    return base;
  }
}

function parseHtml(html: string, base: WebsiteAnalysis): WebsiteAnalysis {
  const $ = cheerio.load(html);
  const text = $("body").text().toLowerCase();
  const htmlLower = html.toLowerCase();

  const title = $("title").first().text().trim() || undefined;
  const description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    undefined;

  const hasViewport = Boolean($('meta[name="viewport"]').attr("content"));

  const hasEmail = (html.match(EMAIL_RE) || []).some(
    (e) =>
      !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e) &&
      !e.includes("wixpress") &&
      !e.includes("sentry")
  );

  const hasPhone = PHONE_RE.test(html) || PHONE_RE.test(text);

  const hasBooking = BOOKING_TERMS.some(
    (term) => text.includes(term) || htmlLower.includes(term)
  );

  const hasContactForm =
    $("form").length > 0 &&
    (CONTACT_FORM_HINTS.some((h) => htmlLower.includes(h)) ||
      $("form input[type='email'], form textarea, form input[name*='email']").length > 0 ||
      text.includes("contact us") ||
      text.includes("get in touch"));

  let hasSocialLinks = false;
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").toLowerCase();
    if (SOCIAL_HOSTS.some((host) => href.includes(host))) {
      hasSocialLinks = true;
    }
  });

  return {
    ...base,
    hasEmail,
    hasPhone,
    hasBooking,
    hasContactForm,
    hasSocialLinks,
    hasViewport,
    title,
    description,
  };
}

/**
 * Analyze many websites with limited concurrency. Skips duplicates via cache.
 */
export async function analyzeWebsitesBatch(
  websites: (string | undefined | null)[]
): Promise<Map<string, WebsiteAnalysis>> {
  const unique = [
    ...new Set(
      websites
        .filter(Boolean)
        .map((w) => normalizeWebsite(w as string) || (w as string))
    ),
  ];

  const results = new Map<string, WebsiteAnalysis>();
  const concurrency = env.WEBSITE_CONCURRENCY;
  let index = 0;

  async function worker() {
    while (index < unique.length) {
      const current = unique[index++];
      const analysis = await analyzeWebsite(current);
      results.set(current, analysis);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}

/** Allow injecting precomputed demo analysis without live HTTP. */
export function applyDemoWebsiteAnalysis(
  website: string | undefined,
  demoAnalysis: WebsiteAnalysis | undefined
): WebsiteAnalysis | undefined {
  if (!website || !demoAnalysis) return demoAnalysis;
  const normalized = normalizeWebsite(website) || website;
  const withTs = { ...demoAnalysis, analyzedAt: new Date() };
  analysisCache.set(normalized, withTs);
  return withTs;
}
