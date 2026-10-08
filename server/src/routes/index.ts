import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";
import { postSearch } from "../controllers/search.controller.js";
import {
  listLeads,
  getLead,
  exportLeadsCsv,
  postLeadInsight,
  postEnrichOwners,
  postEnrichCompanies,
} from "../controllers/leads.controller.js";
import { validate } from "../middleware/validate.js";
import {
  searchSchema,
  leadsQuerySchema,
  idParamSchema,
  enrichOwnersSchema,
} from "../utils/validation.js";

const router = Router();

router.get("/health", getHealth);

router.post("/search", validate(searchSchema, "body"), postSearch);

// Export / enrich before :id to avoid route collision
router.get("/leads/export", validate(leadsQuerySchema, "query"), exportLeadsCsv);
router.post(
  "/leads/enrich-owners",
  validate(enrichOwnersSchema, "body"),
  postEnrichOwners
);
router.post(
  "/leads/enrich-companies",
  validate(enrichOwnersSchema, "body"),
  postEnrichCompanies
);
router.get("/leads", validate(leadsQuerySchema, "query"), listLeads);
router.get("/leads/:id", validate(idParamSchema, "params"), getLead);
router.post("/leads/:id/insight", validate(idParamSchema, "params"), postLeadInsight);

export default router;   
