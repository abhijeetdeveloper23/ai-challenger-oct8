import mongoose from "mongoose";
import { Lead } from "../models/Lead.js";
import { Search } from "../models/Search.js";
import { ScrapeJob } from "../models/ScrapeJob.js";
import { discoverBusinesses } from "./discovery.service.js";
import { deduplicateBusinesses } from "./deduplication.service.js";
import { enrichWithWebsiteAnalysis } from "./scraper.service.js";
import { scoreLead } from "./scoring.service.js";
import { clearWebsiteCache } from "./website.service.js";
import { buildCacheKey } from "../utils/normalize.js";
import { estimateRevenue } from "../utils/revenueEstimate.js";
import { env } from "../config/env.js";
import type { ILead } from "../models/Lead.js";
import { log } from "../utils/logger.js";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface SearchResult {
  searchId: string;
  count: number;
  leads: ILead[];
  cached: boolean;
  isDemo: boolean;
  providers: string[];
  failedProviders: { name: string; error: string }[];
  sourceCounts: Record<string, number>;
  job: {
    status: string;
    totalFound: number;
    processed: number;
    failed: number;
    durationMs: number;
  };
}

export async function searchLeads(
  query: string,
  location: string,
  product?: string
): Promise<SearchResult> {
  const started = Date.now();
  const cacheKey = buildCacheKey(query, location, product);

  log.info(
    "search",
    `POST /search — query="${query}" location="${location}" product="${product || ""}"`
  );

  // Lightweight MongoDB search cache (24h)
  const cached = await Search.findOne({
    cacheKey,
    createdAt: { $gte: new Date(Date.now() - CACHE_TTL_MS) },
  }).sort({ createdAt: -1 });

  if (cached && cached.leadIds?.length) {
    const leads = await Lead.find({ _id: { $in: cached.leadIds } }).sort({
      leadScore: -1,
    });
    log.info("search", `Cache HIT — returning ${leads.length} stored leads`, {
      searchId: cached._id.toString(),
      providers: cached.providers || [],
      durationMs: Date.now() - started,
    });
    return {
      searchId: cached._id.toString(),
      count: leads.length,
      leads,
      cached: true,
      isDemo: Boolean(cached.isDemo),
      providers: cached.providers || [],
      failedProviders: cached.failedProviders || [],
      sourceCounts: {},
      job: {
        status: "completed",
        totalFound: leads.length,
        processed: leads.length,
        failed: 0,
        durationMs: Date.now() - started,
      },
    };
  }

  log.info("search", "Cache MISS — running discovery pipeline");
  clearWebsiteCache();

  const search = await Search.create({
    query,
    location,
    product: product || undefined,
    cacheKey,
    resultCount: 0,
    leadIds: [],
  });

  const job = await ScrapeJob.create({
    searchId: search._id,
    status: "running",
    startedAt: new Date(),
  });

  try {
    const { businesses, isDemo, providers, failedProviders, sourceCounts } =
      await discoverBusinesses(query, location, product);
    const unique = deduplicateBusinesses(businesses);

    log.info("search", "Discovery stage done", {
      sourceCounts,
      providers,
      failedProviders,
      uniqueLeads: unique.length,
      isDemo,
    });

    job.totalFound = businesses.length;
    await job.save();

    log.info(
      "search",
      `Website analysis starting for ${unique.length} leads (concurrency=${env.WEBSITE_CONCURRENCY})`
    );
    const { enriched, failed } = await enrichWithWebsiteAnalysis(
      unique,
      env.WEBSITE_CONCURRENCY
    );
    log.info("search", `Website analysis done`, {
      analyzed: enriched.length,
      softFailures: failed,
    });

    const leadDocs = enriched.map((biz) => {
      const scored = scoreLead(biz, biz.websiteAnalysis, product);
      const revenue = estimateRevenue({
        reviewCount: biz.reviewCount,
        rating: biz.rating,
        category: biz.category,
      });
      return {
        name: biz.name,
        category: biz.category,
        address: biz.address,
        phone: biz.phone,
        email: biz.email,
        website: biz.website,
        rating: biz.rating,
        reviewCount: biz.reviewCount ?? 0,
        source: biz.source,
        sourceId: biz.sourceId,
        websiteAnalysis: biz.websiteAnalysis,
        opportunities: scored.opportunities,
        primaryOpportunity: scored.primaryOpportunity,
        leadScore: scored.leadScore,
        scoreBreakdown: scored.scoreBreakdown,
        scoreReasons: scored.scoreReasons,
        estimatedRevenue: revenue,
        searchId: search._id as mongoose.Types.ObjectId,
        isDemo,
      };
    });

    const inserted = leadDocs.length
      ? await Lead.insertMany(leadDocs, { ordered: false })
      : [];

    const durationMs = Date.now() - started;
    search.resultCount = inserted.length;
    search.durationMs = durationMs;
    search.isDemo = isDemo;
    search.providers = providers;
    search.failedProviders = failedProviders;
    search.leadIds = inserted.map((l) => l._id as mongoose.Types.ObjectId);
    await search.save();

    const status =
      failed > 0 && inserted.length > 0
        ? "partial"
        : inserted.length === 0
          ? "failed"
          : "completed";

    job.status = status;
    job.totalProcessed = inserted.length;
    job.totalFailed = failed;
    job.completedAt = new Date();
    if (status === "failed") job.error = "No leads produced";
    await job.save();

    const leads = await Lead.find({ _id: { $in: inserted.map((l) => l._id) } }).sort({
      leadScore: -1,
    });

    const bySource: Record<string, number> = {};
    for (const lead of leads) {
      const key = lead.source || "unknown";
      bySource[key] = (bySource[key] || 0) + 1;
    }

    log.info("search", `Search complete — ${leads.length} leads saved`, {
      searchId: search._id.toString(),
      status,
      durationMs,
      sourceCountsRaw: sourceCounts,
      savedBySource: bySource,
      providers,
      failedProviders,
      websiteSoftFailures: failed,
    });

    return {
      searchId: search._id.toString(),
      count: leads.length,
      leads,
      cached: false,
      isDemo,
      providers,
      failedProviders,
      sourceCounts,
      job: {
        status,
        totalFound: businesses.length,
        processed: inserted.length,
        failed,
        durationMs,
      },
    };
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Search failed";
    job.completedAt = new Date();
    await job.save();
    log.exception("search", "Search pipeline FAILED", err, {
      query,
      location,
      searchId: search._id.toString(),
    });
    throw err;
  }
}
