import axios from "axios";
import * as cheerio from "cheerio";
import type { HydratedDocument } from "mongoose";
import { env } from "../config/env.js";
import type { ILead } from "../models/Lead.js";
import { Lead } from "../models/Lead.js";
import { log } from "../utils/logger.js";

export type OwnerConfidence = "low" | "medium" | "high";

export interface OwnerDetails {
  ownerName?: string;
  ownerTitle?: string;
  ownerLinkedIn?: string;
  companyLinkedIn?: string;
  parentCompany?: string;
  affiliatedCompanies?: string[];
  ownershipType?: string;
  confidence: OwnerConfidence;
  sources: string[];
  notes?: string;
  enrichedAt: Date;
}

interface OrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
}

const OWNER_TITLE_RE =
  /\b(owner|founder|co-founder|ceo|president|proprietor|managing director|principal)\b/i;

const PERSON_NAME_RE =
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3})\b/g;

const USER_AGENT =
  "LeadIntelligenceBot/1.0 (+https://github.com/lead-intelligence; research/demo)";

/**
 * Enrich selected leads with public owner / decision-maker signals.
 * Uses SerpAPI organic search + optional OpenAI structuring + website LinkedIn scrape.
 * Never invents high-confidence contacts — unknown stays "Not found".
 */
type LeadDoc = HydratedDocument<ILead>;

export async function enrichOwnersForLeads(
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
  const concurrency = 2;
  let index = 0;
  const results: LeadDoc[] = [];

  async function worker() {
    while (index < ordered.length) {
      const i = index++;
      const lead = ordered[i];
      if (!lead) continue;
      try {
        const details = await enrichOneLead(lead);
        lead.ownerDetails = details;
        await lead.save();
        results[i] = lead;
        log.info("owner", `Enriched "${lead.name}"`, {
          confidence: details.confidence,
          owner: details.ownerName || "Not found",
        });
      } catch (err) {
        failed += 1;
        log.exception("owner", `Enrich failed for "${lead.name}"`, err);
        const fallback: OwnerDetails = {
          ownerName: undefined,
          confidence: "low",
          sources: ["Analysis failed due to error"],
          notes: err instanceof Error ? err.message : "Unknown error",
          enrichedAt: new Date(),
          ownershipType: "Other",
        };
        lead.ownerDetails = fallback;
        try {
          await lead.save();
        } catch {
          /* ignore save failure on error path */
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

async function enrichOneLead(lead: ILead): Promise<OwnerDetails> {
  const location = [lead.address?.city, lead.address?.state]
    .filter(Boolean)
    .join(", ");
  const sources: string[] = [];
  let companyLinkedIn: string | undefined;
  let ownerLinkedIn: string | undefined;
  let ownerName: string | undefined;
  let ownerTitle: string | undefined;
  let ownershipType = "Independent";
  let parentCompany: string | undefined;
  let affiliatedCompanies: string[] = [];
  let confidence: OwnerConfidence = "low";
  let notes: string | undefined;

  const siteSignals = await scrapeSiteOwnerSignals(lead.website);
  if (siteSignals.companyLinkedIn) {
    companyLinkedIn = siteSignals.companyLinkedIn;
    sources.push("Company website LinkedIn link");
  }
  if (siteSignals.ownerLinkedIn) {
    ownerLinkedIn = siteSignals.ownerLinkedIn;
    sources.push("Person LinkedIn on website");
  }
  if (siteSignals.ownerName) {
    ownerName = siteSignals.ownerName;
    ownerTitle = siteSignals.ownerTitle || ownerTitle;
    sources.push("Website about / team copy");
  }

  const organic = await searchPublicOwnerSignals(lead.name, location);
  if (organic.length > 0) {
    sources.push("Public web search");
    const fromSearch = extractFromOrganic(organic, lead.name);
    if (!companyLinkedIn && fromSearch.companyLinkedIn) {
      companyLinkedIn = fromSearch.companyLinkedIn;
    }
    if (!ownerLinkedIn && fromSearch.ownerLinkedIn) {
      ownerLinkedIn = fromSearch.ownerLinkedIn;
    }
    if (!ownerName && fromSearch.ownerName) {
      ownerName = fromSearch.ownerName;
      ownerTitle = fromSearch.ownerTitle || ownerTitle;
    }
  }

  if (env.OPENAI_API_KEY && (organic.length > 0 || siteSignals.rawText)) {
    const ai = await structureWithOpenAI({
      leadName: lead.name,
      category: lead.category,
      location,
      website: lead.website,
      organic,
      siteText: siteSignals.rawText,
    });
    if (ai) {
      sources.push("AI extraction from public snippets");
      if (ai.ownerName && !looksLikeCompany(ai.ownerName, lead.name)) {
        ownerName = ai.ownerName;
      }
      if (ai.ownerTitle) ownerTitle = ai.ownerTitle;
      if (ai.ownerLinkedIn && !ownerLinkedIn) ownerLinkedIn = ai.ownerLinkedIn;
      if (ai.companyLinkedIn && !companyLinkedIn) {
        companyLinkedIn = ai.companyLinkedIn;
      }
      if (ai.parentCompany) parentCompany = ai.parentCompany;
      if (ai.affiliatedCompanies?.length) {
        affiliatedCompanies = ai.affiliatedCompanies;
      }
      if (ai.ownershipType) ownershipType = ai.ownershipType;
      if (ai.notes) notes = ai.notes;
    }
  }

  if (ownerName && ownerLinkedIn) confidence = "high";
  else if (ownerName || ownerLinkedIn || companyLinkedIn) confidence = "medium";
  else confidence = "low";

  if (sources.length === 0) {
    sources.push("No public owner signals found");
    notes =
      notes ||
      "Try a broader search or verify the company website for team / about pages.";
  }

  return {
    ownerName: ownerName || undefined,
    ownerTitle,
    ownerLinkedIn,
    companyLinkedIn,
    parentCompany,
    affiliatedCompanies: affiliatedCompanies.length ? affiliatedCompanies : undefined,
    ownershipType,
    confidence,
    sources,
    notes,
    enrichedAt: new Date(),
  };
}

async function searchPublicOwnerSignals(
  company: string,
  location: string
): Promise<OrganicResult[]> {
  if (!env.DISCOVERY_API_KEY) {
    log.info("owner", "No SerpAPI key — skipping public owner search");
    return [];
  }

  const q = [
    `"${company}"`,
    location ? `"${location}"` : "",
    "(owner OR founder OR CEO OR LinkedIn)",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const response = await axios.get("https://serpapi.com/search.json", {
      timeout: 15_000,
      params: {
        engine: "google",
        q,
        num: 8,
        api_key: env.DISCOVERY_API_KEY,
      },
    });
    const organic: OrganicResult[] = response.data?.organic_results || [];
    return organic.slice(0, 8).map((r) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
    }));
  } catch (err) {
    log.exception("owner", `SerpAPI owner search failed for "${company}"`, err);
    return [];
  }
}

function extractFromOrganic(
  organic: OrganicResult[],
  companyName: string
): Partial<OwnerDetails> {
  let companyLinkedIn: string | undefined;
  let ownerLinkedIn: string | undefined;
  let ownerName: string | undefined;
  let ownerTitle: string | undefined;

  for (const row of organic) {
    const link = row.link || "";
    const lower = link.toLowerCase();
    if (lower.includes("linkedin.com/company/") && !companyLinkedIn) {
      companyLinkedIn = link.split("?")[0];
    }
    if (lower.includes("linkedin.com/in/") && !ownerLinkedIn) {
      ownerLinkedIn = link.split("?")[0];
      const fromTitle = extractPersonFromTitle(row.title || "", companyName);
      if (fromTitle) {
        ownerName = fromTitle.name;
        ownerTitle = fromTitle.title;
      }
    }
    if (!ownerName && row.title && OWNER_TITLE_RE.test(row.title)) {
      const fromTitle = extractPersonFromTitle(row.title, companyName);
      if (fromTitle) {
        ownerName = fromTitle.name;
        ownerTitle = fromTitle.title;
      }
    }
    if (!ownerName && row.snippet && OWNER_TITLE_RE.test(row.snippet)) {
      const names = [...row.snippet.matchAll(PERSON_NAME_RE)].map((m) => m[1]);
      const candidate = names.find((n) => !looksLikeCompany(n, companyName));
      if (candidate) {
        ownerName = candidate;
        const titleMatch = row.snippet.match(OWNER_TITLE_RE);
        if (titleMatch) ownerTitle = titleMatch[1];
      }
    }
  }

  return { companyLinkedIn, ownerLinkedIn, ownerName, ownerTitle };
}

function extractPersonFromTitle(
  title: string,
  companyName: string
): { name: string; title?: string } | null {
  const cleaned = title.split("|")[0]?.split("-")[0]?.trim() || title;
  const names = [...cleaned.matchAll(PERSON_NAME_RE)].map((m) => m[1]);
  const candidate = names.find((n) => !looksLikeCompany(n, companyName));
  if (!candidate) return null;
  const titleMatch = title.match(OWNER_TITLE_RE);
  return { name: candidate, title: titleMatch?.[1] };
}

function looksLikeCompany(name: string, companyName: string): boolean {
  const a = name.toLowerCase();
  const b = companyName.toLowerCase();
  if (a === b) return true;
  if (b.includes(a) && a.split(" ").length >= 2) return true;
  return /\b(llc|inc|corp|ltd|hospital|clinic|city|county|center|centre)\b/i.test(
    name
  );
}

async function scrapeSiteOwnerSignals(website?: string): Promise<{
  companyLinkedIn?: string;
  ownerLinkedIn?: string;
  ownerName?: string;
  ownerTitle?: string;
  rawText?: string;
}> {
  if (!website) return {};
  const url = website.startsWith("http") ? website : `https://${website}`;

  try {
    const response = await axios.get(url, {
      timeout: env.WEBSITE_TIMEOUT_MS,
      maxRedirects: 3,
      validateStatus: (s) => s >= 200 && s < 400,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      responseType: "text",
    });
    if (typeof response.data !== "string") return {};
    const $ = cheerio.load(response.data);
    let companyLinkedIn: string | undefined;
    let ownerLinkedIn: string | undefined;

    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") || "").split("?")[0];
      const lower = href.toLowerCase();
      if (lower.includes("linkedin.com/company/") && !companyLinkedIn) {
        companyLinkedIn = href.startsWith("http") ? href : `https://${href}`;
      }
      if (lower.includes("linkedin.com/in/") && !ownerLinkedIn) {
        ownerLinkedIn = href.startsWith("http") ? href : `https://${href}`;
      }
    });

    const text = $("body").text().replace(/\s+/g, " ").slice(0, 4000);
    let ownerName: string | undefined;
    let ownerTitle: string | undefined;
    const ownerSentence = text.match(
      /(?:owned by|founder[:\s]+|owner[:\s]+|ceo[:\s]+)([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,2})/i
    );
    if (ownerSentence?.[1]) {
      ownerName = ownerSentence[1].trim();
      ownerTitle = "Owner";
    }

    return {
      companyLinkedIn,
      ownerLinkedIn,
      ownerName,
      ownerTitle,
      rawText: text.slice(0, 1500),
    };
  } catch (err) {
    log.warn("owner", `Website scrape soft-fail — ${website}`, {
      message: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}

async function structureWithOpenAI(input: {
  leadName: string;
  category?: string;
  location: string;
  website?: string;
  organic: OrganicResult[];
  siteText?: string;
}): Promise<{
  ownerName?: string;
  ownerTitle?: string;
  ownerLinkedIn?: string;
  companyLinkedIn?: string;
  parentCompany?: string;
  affiliatedCompanies?: string[];
  ownershipType?: string;
  notes?: string;
} | null> {
  const snippets = input.organic
    .map(
      (o, i) =>
        `${i + 1}. ${o.title || ""}\n   ${o.link || ""}\n   ${o.snippet || ""}`
    )
    .join("\n");

  const prompt = [
    "Extract business ownership / decision-maker details from public snippets only.",
    "Return strict JSON with keys: ownerName, ownerTitle, ownerLinkedIn, companyLinkedIn, parentCompany, affiliatedCompanies (array), ownershipType, notes.",
    "If unknown, use null. Never invent LinkedIn URLs or names not supported by the snippets.",
    `Company: ${input.leadName}`,
    `Category: ${input.category || "n/a"}`,
    `Location: ${input.location || "n/a"}`,
    `Website: ${input.website || "n/a"}`,
    "Search snippets:",
    snippets || "(none)",
    input.siteText ? `Website excerpt: ${input.siteText}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You extract structured B2B owner intel. Output JSON only. Prefer null over guesses.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 350,
        response_format: { type: "json_object" },
      },
      {
        timeout: 25_000,
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const raw = response.data?.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const str = (k: string) =>
      typeof parsed[k] === "string" && (parsed[k] as string).trim()
        ? (parsed[k] as string).trim()
        : undefined;
    const affiliated = Array.isArray(parsed.affiliatedCompanies)
      ? (parsed.affiliatedCompanies as unknown[])
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
      : undefined;

    return {
      ownerName: str("ownerName"),
      ownerTitle: str("ownerTitle"),
      ownerLinkedIn: str("ownerLinkedIn"),
      companyLinkedIn: str("companyLinkedIn"),
      parentCompany: str("parentCompany"),
      affiliatedCompanies: affiliated,
      ownershipType: str("ownershipType"),
      notes: str("notes"),
    };
  } catch (err) {
    log.exception("owner", `OpenAI owner structuring failed for "${input.leadName}"`, err);
    return null;
  }
}
