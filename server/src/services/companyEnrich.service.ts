import axios from "axios";
import * as cheerio from "cheerio";
import type { HydratedDocument } from "mongoose";
import { env } from "../config/env.js";
import type { ILead } from "../models/Lead.js";
import { Lead } from "../models/Lead.js";
import { estimateRevenue } from "../utils/revenueEstimate.js";
import {
  analyzeWebsite,
  invalidateWebsiteCache,
} from "./website.service.js";
import { generateAiBusinessProfile } from "./insight.service.js";
import { log } from "../utils/logger.js";

export interface CompanyEnrichment {
  emails: string[];
  phones: string[];
  socialLinks: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    youtube?: string;
  };
  pageTitle?: string;
  pageDescription?: string;
  hasBooking: boolean;
  hasContactForm: boolean;
  hasSocialLinks: boolean;
  websiteReachable: boolean;
  /** Optional LLM summary from known facts only */
  aiProfile?: string;
  sources: string[];
  enrichedAt: Date;
}

type LeadDoc = HydratedDocument<ILead>;

const USER_AGENT =
  "LeadIntelligenceBot/1.0 (+https://github.com/lead-intelligence; research/demo)";
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;

/**
 * Company enrichment (not people): refresh website signals, pull emails /
 * phones / social URLs, and refresh revenue estimate.
 */
export async function enrichCompaniesForLeads(
  leadIds: string[]
): Promise<{ results: LeadDoc[]; failed: number }> {
  const leads = await Lead.find({ _id: { $in: leadIds } });
  const byId = new Map(leads.map((l) => [String(l._id), l]));
  const ordered: LeadDoc[] = [];
  for (const id of leadIds) {
    const doc = byId.get(id);
    if (doc) ordered.push(doc);
  }

  let failed = 0;
  const concurrency = 3;
  let index = 0;
  const results: LeadDoc[] = [];

  async function worker() {
    while (index < ordered.length) {
      const i = index++;
      const lead = ordered[i];
      if (!lead) continue;
      try {
        const details = await enrichOneCompany(lead);
        const aiProfile = await generateAiBusinessProfile(lead);
        if (aiProfile) {
          details.aiProfile = aiProfile;
          details.sources = [...details.sources, "AI business profile"];
        }
        lead.companyEnrichment = details;
        if (!lead.email && details.emails[0]) lead.email = details.emails[0];
        if (!lead.phone && details.phones[0]) lead.phone = details.phones[0];
        lead.estimatedRevenue = estimateRevenue({
          reviewCount: lead.reviewCount,
          rating: lead.rating,
          category: lead.category,
        });
        if (lead.website) {
          invalidateWebsiteCache(lead.website);
          lead.websiteAnalysis = await analyzeWebsite(lead.website);
        }
        await lead.save();
        results[i] = lead;
        log.info("company-enrich", `Enriched company "${lead.name}"`, {
          emails: details.emails.length,
          socials: Object.keys(details.socialLinks).length,
          aiProfile: Boolean(aiProfile),
        });
      } catch (err) {
        failed += 1;
        log.exception("company-enrich", `Failed for "${lead.name}"`, err);
        lead.companyEnrichment = {
          emails: [],
          phones: [],
          socialLinks: {},
          hasBooking: false,
          hasContactForm: false,
          hasSocialLinks: false,
          websiteReachable: false,
          sources: ["Company enrichment failed"],
          enrichedAt: new Date(),
        };
        try {
          await lead.save();
        } catch {
          /* ignore */
        }
        results[i] = lead;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ordered.length) }, () => worker())
  );

  return { results: results.filter(Boolean), failed };
}

async function enrichOneCompany(lead: ILead): Promise<CompanyEnrichment> {
  const sources: string[] = [];
  if (!lead.website) {
    return {
      emails: lead.email ? [lead.email] : [],
      phones: lead.phone ? [lead.phone] : [],
      socialLinks: {},
      hasBooking: false,
      hasContactForm: false,
      hasSocialLinks: false,
      websiteReachable: false,
      sources: ["No website on file — limited company enrichment"],
      enrichedAt: new Date(),
    };
  }

  const url = lead.website.startsWith("http")
    ? lead.website
    : `https://${lead.website}`;

  try {
    const response = await axios.get(url, {
      timeout: env.WEBSITE_TIMEOUT_MS,
      maxRedirects: 3,
      validateStatus: (s) => s >= 200 && s < 400,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      responseType: "text",
    });

    if (typeof response.data !== "string") {
      return emptyEnrichment(["Website returned non-HTML"]);
    }

    sources.push("Company website scrape");
    const $ = cheerio.load(response.data);
    const html = response.data;
    const text = $("body").text().toLowerCase();
    const htmlLower = html.toLowerCase();

    const emails = [
      ...new Set(
        (html.match(EMAIL_RE) || []).filter(
          (e) =>
            !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e) &&
            !e.includes("wixpress") &&
            !e.includes("sentry") &&
            !e.includes("example.com")
        )
      ),
    ].slice(0, 5);

    const phones = [
      ...new Set(
        (html.match(PHONE_RE) || [])
          .map((p) => p.trim())
          .filter((p) => p.replace(/\D/g, "").length >= 8)
      ),
    ].slice(0, 5);

    const socialLinks: CompanyEnrichment["socialLinks"] = {};
    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") || "").split("?")[0];
      const lower = href.toLowerCase();
      const abs = href.startsWith("http") ? href : undefined;
      if (!abs) return;
      if (lower.includes("facebook.com") && !socialLinks.facebook) {
        socialLinks.facebook = abs;
      } else if (lower.includes("instagram.com") && !socialLinks.instagram) {
        socialLinks.instagram = abs;
      } else if (lower.includes("linkedin.com") && !socialLinks.linkedin) {
        socialLinks.linkedin = abs;
      } else if (
        (lower.includes("twitter.com") || lower.includes("x.com/")) &&
        !socialLinks.twitter
      ) {
        socialLinks.twitter = abs;
      } else if (lower.includes("youtube.com") && !socialLinks.youtube) {
        socialLinks.youtube = abs;
      }
    });

    const BOOKING = [
      "book",
      "booking",
      "appointment",
      "schedule",
      "reserve",
      "book now",
      "book online",
    ];
    const hasBooking = BOOKING.some(
      (t) => text.includes(t) || htmlLower.includes(t)
    );
    const hasContactForm =
      $("form").length > 0 &&
      ($("form input[type='email'], form textarea").length > 0 ||
        text.includes("contact us") ||
        text.includes("get in touch"));

    return {
      emails,
      phones,
      socialLinks,
      pageTitle: $("title").first().text().trim() || undefined,
      pageDescription:
        $('meta[name="description"]').attr("content")?.trim() || undefined,
      hasBooking,
      hasContactForm,
      hasSocialLinks: Object.keys(socialLinks).length > 0,
      websiteReachable: true,
      sources,
      enrichedAt: new Date(),
    };
  } catch (err) {
    log.warn("company-enrich", `Website soft-fail — ${lead.website}`, {
      message: err instanceof Error ? err.message : String(err),
    });
    return emptyEnrichment(["Website unreachable or timed out"]);
  }
}

function emptyEnrichment(sources: string[]): CompanyEnrichment {
  return {
    emails: [],
    phones: [],
    socialLinks: {},
    hasBooking: false,
    hasContactForm: false,
    hasSocialLinks: false,
    websiteReachable: false,
    sources,
    enrichedAt: new Date(),
  };
}
