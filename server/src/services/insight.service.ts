import axios from "axios";
import { env } from "../config/env.js";
import type { ILead } from "../models/Lead.js";
import { Search } from "../models/Search.js";
import { AppError } from "../utils/AppError.js";
import { getLeadPriority } from "../utils/priority.js";
import { log } from "../utils/logger.js";

/**
 * Structured AI brief for a lead. Narrative only — never changes leadScore.
 */
export interface AiBrief {
  businessSummary: string;
  whyUseful: string;
  approachSteps: string[];
  talkingPoints: string[];
  pitchAngle: string;
  generatedAt: Date;
  model?: string;
}

/**
 * Generate (and optionally persist) an AI approach guide for this lead.
 */
export async function generateSalesInsight(lead: ILead): Promise<AiBrief> {
  const product = await resolveProduct(lead);

  if (!env.OPENAI_API_KEY) {
    log.info("insight", `No OPENAI_API_KEY — heuristic brief for "${lead.name}"`);
    return buildHeuristicBrief(lead, product);
  }

  try {
    const brief = await callOpenAiBrief(lead, product);
    log.info("insight", `OpenAI brief generated for "${lead.name}"`);
    return brief;
  } catch (err) {
    if (err instanceof AppError) {
      log.exception("insight", `Insight AppError for "${lead.name}"`, err);
      throw err;
    }
    log.exception(
      "insight",
      `OpenAI failed — falling back to heuristic for "${lead.name}"`,
      err
    );
    return buildHeuristicBrief(lead, product);
  }
}

/**
 * Short LLM business profile used during company enrichment.
 * Facts-only; null if no key or failure.
 */
export async function generateAiBusinessProfile(lead: ILead): Promise<string | null> {
  if (!env.OPENAI_API_KEY) return null;

  const location = [lead.address?.city, lead.address?.state]
    .filter(Boolean)
    .join(", ");
  const prompt = [
    "Write 2 short sentences about this local business for a salesperson.",
    "Use only the facts given. Do not invent owners, revenue numbers, or contact info.",
    `Name: ${lead.name}`,
    `Category: ${lead.category || "n/a"}`,
    `Location: ${location || "n/a"}`,
    `Rating: ${lead.rating ?? "n/a"} (${lead.reviewCount ?? 0} reviews)`,
    `Website: ${lead.website || "none"}`,
    `Phone: ${lead.phone || "none"}`,
    `Primary opportunity: ${lead.primaryOpportunity || "n/a"}`,
  ].join("\n");

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You summarize local businesses for B2B outreach. Be concrete and honest. Never invent facts.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 120,
      },
      {
        timeout: 20_000,
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const text = response.data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (err) {
    log.exception("insight", `AI business profile failed for "${lead.name}"`, err);
    return null;
  }
}

async function resolveProduct(lead: ILead): Promise<string | undefined> {
  if (!lead.searchId) return undefined;
  try {
    const search = await Search.findById(lead.searchId).select("product").lean();
    return search?.product || undefined;
  } catch {
    return undefined;
  }
}

async function callOpenAiBrief(lead: ILead, product?: string): Promise<AiBrief> {
  const priority = getLeadPriority(lead.leadScore);
  const location = [lead.address?.city, lead.address?.state, lead.address?.country]
    .filter(Boolean)
    .join(", ");
  const revenue = lead.estimatedRevenue?.label || "unknown";
  const owner = lead.ownerDetails?.ownerName || "unknown";
  const companyEnrich = lead.companyEnrichment;

  const prompt = [
    "You help a salesperson decide how to approach this lead.",
    "Return strict JSON with keys:",
    "businessSummary (2-3 sentences about the business from given facts),",
    "whyUseful (2 sentences: why this lead is useful for the seller),",
    "approachSteps (array of 3-5 short actionable steps),",
    "talkingPoints (array of 3-5 short pitch bullets),",
    "pitchAngle (one sentence opening angle).",
    "Do NOT invent phone, email, website, owner, or revenue. If missing, say so and adapt the approach.",
    "Do NOT invent or change the lead score.",
    "",
    `Business: ${lead.name}`,
    `Category: ${lead.category || "n/a"}`,
    `Location: ${location || "n/a"}`,
    `Score: ${lead.leadScore}/100 (${priority.level}) — already computed`,
    `Rating: ${lead.rating ?? "n/a"} | Reviews: ${lead.reviewCount ?? 0}`,
    `Phone: ${lead.phone || "none"} | Email: ${lead.email || "none"} | Website: ${lead.website || "none"}`,
    `Est. revenue band: ${revenue} (${lead.estimatedRevenue?.confidence || "n/a"} confidence)`,
    `Owner: ${owner}`,
    `Seller offer / product: ${product || "not specified"}`,
    `Primary opportunity: ${lead.primaryOpportunity || "n/a"}`,
    `Score reasons: ${(lead.scoreReasons || []).join("; ") || "n/a"}`,
    `Opportunity tags: ${(lead.opportunities || []).join("; ") || "n/a"}`,
    companyEnrich
      ? `Company enrich: emails=${(companyEnrich.emails || []).join(",") || "none"}; booking=${companyEnrich.hasBooking}; form=${companyEnrich.hasContactForm}; social=${companyEnrich.hasSocialLinks}`
      : "Company enrich: not run yet",
  ].join("\n");

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: env.OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a practical B2B sales coach. Output JSON only. Never invent contact details or scores.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.35,
      max_tokens: 550,
      response_format: { type: "json_object" },
    },
    {
      timeout: 30_000,
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const raw = response.data?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new AppError("Empty insight response", 502);

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const str = (k: string) =>
    typeof parsed[k] === "string" && (parsed[k] as string).trim()
      ? (parsed[k] as string).trim()
      : "";
  const arr = (k: string) =>
    Array.isArray(parsed[k])
      ? (parsed[k] as unknown[])
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
          .slice(0, 6)
      : [];

  const brief: AiBrief = {
    businessSummary: str("businessSummary") || `${lead.name} is a local ${lead.category || "business"}.`,
    whyUseful: str("whyUseful") || "Worth reviewing based on activity and opportunity signals.",
    approachSteps: arr("approachSteps").length
      ? arr("approachSteps")
      : ["Call during business hours", "Lead with the primary opportunity", "Ask about current tools"],
    talkingPoints: arr("talkingPoints").length
      ? arr("talkingPoints")
      : [lead.primaryOpportunity || "Offer a clear next step"],
    pitchAngle: str("pitchAngle") || lead.primaryOpportunity || "Open with a specific, relevant offer",
    generatedAt: new Date(),
    model: env.OPENAI_MODEL,
  };

  return brief;
}

function buildHeuristicBrief(lead: ILead, product?: string): AiBrief {
  const reviews = lead.reviewCount ?? 0;
  const rating = lead.rating;
  const hasPhone = Boolean(lead.phone);
  const hasWebsite = Boolean(lead.website);

  const businessSummary = [
    `${lead.name} is a ${lead.category || "local"} business`,
    lead.address?.city ? `in ${lead.address.city}` : null,
    reviews > 0
      ? `with ${reviews} reviews${rating ? ` and a ${rating}★ rating` : ""}`
      : "with limited public review data",
    hasWebsite ? "and an online presence." : "and no website detected.",
  ]
    .filter(Boolean)
    .join(" ");

  const whyUseful = [
    `Lead score ${lead.leadScore}/100`,
    lead.primaryOpportunity
      ? `points to “${lead.primaryOpportunity}”`
      : "shows a general outreach opportunity",
    product ? `for your offer (${product}).` : ".",
    !hasWebsite
      ? " Weak digital presence + strong reviews often means they will listen to a web / marketing pitch."
      : "",
  ].join(" ");

  const approachSteps = [
    hasPhone
      ? "Call the listed number and ask for the owner or manager."
      : "Find a contact path (Google listing, walk-in, or enrichment) before pitching.",
    product
      ? `Lead with how ${product} helps a busy ${lead.category || "business"} like theirs.`
      : `Lead with the opportunity: ${lead.primaryOpportunity || "clear digital gap"}.`,
    !hasWebsite
      ? "Show a simple before/after: Google listing → professional site + booking."
      : "Ask which tools they use today for bookings, ads, and follow-up.",
    "Offer a short audit or demo, not a long pitch.",
    "Confirm a follow-up time while you have them.",
  ];

  const talkingPoints = [
    reviews >= 50 ? `${reviews} reviews show real customer demand` : "Active local business",
    rating && rating >= 4.5 ? `Strong ${rating}★ reputation to protect online` : "Room to improve digital presence",
    !hasWebsite ? "No website — easy entry for web / listing work" : "Website exists — look for booking / conversion gaps",
    !lead.email ? "No email on file — phone / in-person first touch" : "Email available for a short follow-up",
    product ? `Tie every point back to ${product}` : "Keep the ask to one clear next step",
  ];

  return {
    businessSummary,
    whyUseful,
    approachSteps,
    talkingPoints,
    pitchAngle: product
      ? `I help ${lead.category || "local"} businesses with ${product} — noticed ${lead.name} is strong offline but weak online.`
      : `Noticed ${lead.name} has strong customer activity but a digital gap worth a quick conversation.`,
    generatedAt: new Date(),
    model: "heuristic",
  };
}
