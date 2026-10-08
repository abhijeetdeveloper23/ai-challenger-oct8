import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { BusinessCandidate, WebsiteAnalysis } from "../types/index.js";
import type { BusinessDiscoveryProvider } from "./BusinessDiscoveryProvider.js";
import { applyDemoWebsiteAnalysis } from "../services/website.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface DemoRecord extends BusinessCandidate {
  _demoWebsite?: WebsiteAnalysis;
  _note?: string;
}

/**
 * Deterministic demo provider — always works without external APIs.
 */
export class DemoDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly name = "demo";

  async searchBusinesses(
    query: string,
    location: string
  ): Promise<BusinessCandidate[]> {
    const filePath = path.resolve(__dirname, "../../data/demo-leads.json");
    const raw = await readFile(filePath, "utf-8");
    const records = JSON.parse(raw) as DemoRecord[];

    const q = query.toLowerCase().trim();
    const loc = location.toLowerCase().trim();

    const filtered = records.filter((r) => {
      const categoryMatch =
        !q ||
        (r.category || "").toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        q.includes((r.category || "").toLowerCase()) ||
        // Common aliases for dentist demo
        (q.includes("dentist") && (r.category || "").toLowerCase() === "dentist") ||
        (q.includes("dental") && (r.category || "").toLowerCase() === "dentist");

      const locationMatch =
        !loc ||
        (r.address?.city || "").toLowerCase().includes(loc) ||
        (r.address?.state || "").toLowerCase().includes(loc) ||
        loc.includes((r.address?.city || "").toLowerCase());

      return categoryMatch && locationMatch;
    });

    // Seed website analysis cache from demo metadata
    return filtered.map((r) => {
      const { _demoWebsite, _note, ...candidate } = r;
      if (_demoWebsite) {
        applyDemoWebsiteAnalysis(candidate.website, {
          ..._demoWebsite,
          analyzedAt: new Date(),
        });
      }
      return {
        ...candidate,
        email: candidate.email || undefined,
        phone: candidate.phone || undefined,
        website: candidate.website || undefined,
        source: "demo",
      } as BusinessCandidate;
    });
  }
}
