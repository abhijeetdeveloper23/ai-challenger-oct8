import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Lead } from "../models/Lead.js";
import { AppError } from "../utils/AppError.js";
import { getLeadPriority, priorityToScoreRange } from "../utils/priority.js";
import { generateSalesInsight } from "../services/insight.service.js";
import { enrichOwnersForLeads } from "../services/owner.service.js";
import { enrichCompaniesForLeads } from "../services/companyEnrich.service.js";
import { log } from "../utils/logger.js";

function buildLeadFilter(query: Record<string, unknown>): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  const scoreCond: { $gte?: number; $lte?: number } = {};
  if (typeof query.minScore === "number") scoreCond.$gte = query.minScore;
  if (typeof query.maxScore === "number") scoreCond.$lte = query.maxScore;

  if (typeof query.priority === "string" && query.priority) {
    const range = priorityToScoreRange(query.priority);
    if (range) {
      scoreCond.$gte = Math.max(scoreCond.$gte ?? 0, range.min);
      scoreCond.$lte = Math.min(scoreCond.$lte ?? 100, range.max);
    }
  }

  if (scoreCond.$gte !== undefined || scoreCond.$lte !== undefined) {
    filter.leadScore = scoreCond;
  }

  if (typeof query.city === "string" && query.city) {
    filter["address.city"] = new RegExp(`^${escapeRegex(query.city)}$`, "i");
  }

  if (typeof query.category === "string" && query.category) {
    filter.category = new RegExp(escapeRegex(query.category), "i");
  }

  if (query.hasWebsite === true) {
    filter.website = { $exists: true, $nin: [null, ""] };
  } else if (query.hasWebsite === false) {
    filter.$or = [{ website: { $exists: false } }, { website: null }, { website: "" }];
  }

  if (query.hasPhone === true) {
    filter.phone = { $exists: true, $nin: [null, ""] };
  } else if (query.hasPhone === false) {
    filter.$and = [
      ...(Array.isArray(filter.$and) ? (filter.$and as object[]) : []),
      { $or: [{ phone: { $exists: false } }, { phone: null }, { phone: "" }] },
    ];
  }

  if (query.hasEmail === true) {
    filter.email = { $exists: true, $nin: [null, ""] };
  } else if (query.hasEmail === false) {
    filter.$and = [
      ...(Array.isArray(filter.$and) ? (filter.$and as object[]) : []),
      { $or: [{ email: { $exists: false } }, { email: null }, { email: "" }] },
    ];
  }

  if (typeof query.opportunity === "string" && query.opportunity) {
    const opp = query.opportunity.replace(/-/g, " ");
    filter.opportunities = new RegExp(escapeRegex(opp), "i");
  }

  if (typeof query.searchId === "string" && query.searchId) {
    if (mongoose.Types.ObjectId.isValid(query.searchId)) {
      filter.searchId = new mongoose.Types.ObjectId(query.searchId);
    }
  }

  // Free-text search across name, category and city. Pushed onto $and so it
  // never clobbers the $or used by the hasWebsite=false filter above.
  if (typeof query.q === "string" && query.q.trim()) {
    const rx = new RegExp(escapeRegex(query.q.trim()), "i");
    filter.$and = [
      ...(Array.isArray(filter.$and) ? (filter.$and as object[]) : []),
      { $or: [{ name: rx }, { category: rx }, { "address.city": rx }] },
    ];
  }

  return filter;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortSpec(sort?: string): Record<string, 1 | -1> {
  switch (sort) {
    case "reviews":
      return { reviewCount: -1 };
    case "rating":
      return { rating: -1 };
    case "name":
      return { name: 1 };
    case "revenue":
      return { "estimatedRevenue.midpoint": -1 };
    default:
      return { leadScore: -1, createdAt: -1 };
  }
}

export async function listLeads(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = req.query as unknown as {
      page: number;
      limit: number;
      minScore?: number;
      maxScore?: number;
      priority?: string;
      city?: string;
      category?: string;
      hasWebsite?: boolean;
      hasPhone?: boolean;
      hasEmail?: boolean;
      opportunity?: string;
      searchId?: string;
      q?: string;
      sort?: string;
    };

    const filter = buildLeadFilter(q as unknown as Record<string, unknown>);
    const page = q.page || 1;
    const limit = q.limit || 20;
    const skip = (page - 1) * limit;

    const [leads, total] = await Promise.all([
      Lead.find(filter).sort(sortSpec(q.sort)).skip(skip).limit(limit),
      Lead.countDocuments(filter),
    ]);

    // Summary stats for current filter (uncapped)
    const allForStats = await Lead.find(filter).select("leadScore opportunities").lean();
    const summary = {
      total,
      hot: allForStats.filter((l) => l.leadScore >= 85).length,
      high: allForStats.filter((l) => l.leadScore >= 70 && l.leadScore < 85).length,
      medium: allForStats.filter((l) => l.leadScore >= 50 && l.leadScore < 70).length,
      low: allForStats.filter((l) => l.leadScore < 50).length,
      opportunities: allForStats.reduce(
        (acc, l) => acc + (l.opportunities?.length || 0),
        0
      ),
    };

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      summary,
      leads: leads.map((lead) => {
        const priority = getLeadPriority(lead.leadScore);
        return {
          ...lead.toObject(),
          priority: priority.level,
          priorityLabel: priority.label,
        };
      }),
    });
  } catch (err) {
    log.exception("controller:leads", "GET /api/leads failed", err, {
      query: req.query,
    });
    next(err);
  }
}

export async function getLead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid lead id", 400);
    }

    const lead = await Lead.findById(id);
    if (!lead) throw new AppError("Lead not found", 404);

    const priority = getLeadPriority(lead.leadScore);
    res.json({
      ...lead.toObject(),
      priority: priority.level,
      priorityLabel: priority.label,
    });
  } catch (err) {
    log.exception("controller:leads", `GET /api/leads/${req.params.id} failed`, err);
    next(err);
  }
}

export async function exportLeadsCsv(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filter = buildLeadFilter(req.query as unknown as Record<string, unknown>);
    const leads = await Lead.find(filter).sort({ leadScore: -1 }).limit(1000);

    const header = [
      "Name",
      "Category",
      "Phone",
      "Email",
      "Website",
      "City",
      "Rating",
      "Review Count",
      "Est. Revenue",
      "Revenue Confidence",
      "Lead Score",
      "Priority",
      "Primary Opportunity",
      "Reasons",
    ];

    const rows = leads.map((lead) => {
      const priority = getLeadPriority(lead.leadScore).level;
      return [
        csvEscape(safeCell(lead.name)),
        csvEscape(safeCell(lead.category || "")),
        // Phone numbers legitimately start with "+", so they are not neutralised.
        csvEscape(lead.phone || ""),
        csvEscape(safeCell(lead.email || "")),
        csvEscape(safeCell(lead.website || "")),
        csvEscape(safeCell(lead.address?.city || "")),
        lead.rating ?? "",
        lead.reviewCount ?? 0,
        csvEscape(safeCell(lead.estimatedRevenue?.label || "")),
        lead.estimatedRevenue?.confidence || "",
        lead.leadScore,
        priority,
        csvEscape(safeCell(lead.primaryOpportunity || "")),
        csvEscape(safeCell((lead.scoreReasons || []).join("; "))),
      ].join(",");
    });

    // BOM so Excel opens the file as UTF-8 instead of mangling non-ASCII names.
    const csv = "\uFEFF" + [header.join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="leads-export-${Date.now()}.csv"`
    );
    res.send(csv);
  } catch (err) {
    log.exception("controller:leads", "GET /api/leads/export failed", err, {
      query: req.query,
    });
    next(err);
  }
}

export async function postLeadInsight(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid lead id", 400);
    }
    const lead = await Lead.findById(id);
    if (!lead) throw new AppError("Lead not found", 404);

    const brief = await generateSalesInsight(lead);
    lead.aiBrief = brief;
    await lead.save();

    const insight = [
      brief.businessSummary,
      brief.whyUseful,
      `Pitch: ${brief.pitchAngle}`,
      ...brief.approachSteps.map((s, i) => `${i + 1}. ${s}`),
    ].join("\n\n");

    res.json({ leadId: id, insight, brief });
  } catch (err) {
    log.exception(
      "controller:leads",
      `POST /api/leads/${req.params.id}/insight failed`,
      err
    );
    next(err);
  }
}

function mapEnrichedLeads(
  results: { toObject: () => object; leadScore: number }[]
) {
  return results.map((lead) => {
    const priority = getLeadPriority(lead.leadScore);
    return {
      ...lead.toObject(),
      priority: priority.level,
      priorityLabel: priority.label,
    };
  });
}

/** People enrichment — owner / LinkedIn / decision-maker. */
export async function postEnrichOwners(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const leadIds = (req.body.leadIds as string[]).filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    if (leadIds.length === 0) {
      throw new AppError("No valid lead ids provided", 400);
    }

    log.info("controller:leads", `POST /api/leads/enrich-owners`, {
      count: leadIds.length,
    });

    const { results, failed } = await enrichOwnersForLeads(leadIds);
    res.json({
      count: results.length,
      failed,
      leads: mapEnrichedLeads(results),
    });
  } catch (err) {
    log.exception("controller:leads", "POST /api/leads/enrich-owners failed", err);
    next(err);
  }
}

/** Company enrichment — website contacts, social, revenue refresh (not owners). */
export async function postEnrichCompanies(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const leadIds = (req.body.leadIds as string[]).filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    if (leadIds.length === 0) {
      throw new AppError("No valid lead ids provided", 400);
    }

    log.info("controller:leads", `POST /api/leads/enrich-companies`, {
      count: leadIds.length,
    });

    const { results, failed } = await enrichCompaniesForLeads(leadIds);
    res.json({
      count: results.length,
      failed,
      leads: mapEnrichedLeads(results),
    });
  } catch (err) {
    log.exception(
      "controller:leads",
      "POST /api/leads/enrich-companies failed",
      err
    );
    next(err);
  }
}

/**
 * Scraped business data is untrusted. A cell starting with = + - @ is run as
 * a formula when the CSV is opened in Excel/Sheets, so neutralise it.
 */
function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
