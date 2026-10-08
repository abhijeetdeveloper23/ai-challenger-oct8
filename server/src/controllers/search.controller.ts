import type { Request, Response, NextFunction } from "express";
import { searchLeads } from "../services/search.service.js";
import { getLeadPriority } from "../utils/priority.js";
import { log } from "../utils/logger.js";

export async function postSearch(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { query, location, product } = req.body as {
      query: string;
      location: string;
      product?: string;
    };
    const result = await searchLeads(query, location, product);

    res.status(200).json({
      searchId: result.searchId,
      count: result.count,
      cached: result.cached,
      isDemo: result.isDemo,
      providers: result.providers,
      failedProviders: result.failedProviders,
      sourceCounts: result.sourceCounts,
      product: product || null,
      job: result.job,
      leads: result.leads.map((lead) => {
        const priority = getLeadPriority(lead.leadScore);
        return {
          ...lead.toObject(),
          priority: priority.level,
          priorityLabel: priority.label,
        };
      }),
    });
  } catch (err) {
    log.exception("controller:search", "POST /api/search failed", err, {
      body: req.body,
    });
    next(err);
  }
}
