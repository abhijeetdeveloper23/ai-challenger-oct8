import axios from "axios";
import type {
  AiBrief,
  Lead,
  LeadFilters,
  LeadsResponse,
  SearchResponse,
} from "../types/lead";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 60_000,
  headers: { "Content-Type": "application/json" },
});

export async function searchLeads(
  query: string,
  location: string,
  product?: string
): Promise<SearchResponse> {
  const { data } = await api.post<SearchResponse>("/search", {
    query,
    location,
    ...(product?.trim() ? { product: product.trim() } : {}),
  });
  return data;
}

export async function fetchLeads(filters: LeadFilters = {}): Promise<LeadsResponse> {
  const params: Record<string, string | number> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (typeof value === "boolean") {
      params[key] = value ? "true" : "false";
    } else {
      params[key] = value;
    }
  });
  const { data } = await api.get<LeadsResponse>("/leads", { params });
  return data;
}

export async function fetchLead(id: string): Promise<Lead> {
  const { data } = await api.get<Lead>(`/leads/${id}`);
  return data;
}

export async function fetchInsight(
  id: string
): Promise<{ insight: string; brief: AiBrief }> {
  const { data } = await api.post<{
    leadId: string;
    insight: string;
    brief: AiBrief;
  }>(`/leads/${id}/insight`, undefined, { timeout: 45_000 });
  return data;
}

export async function enrichOwners(
  leadIds: string[]
): Promise<{ count: number; failed: number; leads: Lead[] }> {
  const { data } = await api.post<{
    count: number;
    failed: number;
    leads: Lead[];
  }>("/leads/enrich-owners", { leadIds }, { timeout: 180_000 });
  return data;
}

/** Company data enrichment (website contacts / social / revenue) — not owners. */
export async function enrichCompanies(
  leadIds: string[]
): Promise<{ count: number; failed: number; leads: Lead[] }> {
  const { data } = await api.post<{
    count: number;
    failed: number;
    leads: Lead[];
  }>("/leads/enrich-companies", { leadIds }, { timeout: 180_000 });
  return data;
}

export function getExportUrl(filters: LeadFilters = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (typeof value === "boolean") {
      params.set(key, value ? "true" : "false");
    } else {
      params.set(key, String(value));
    }
  });
  const base = import.meta.env.VITE_API_URL || "/api";
  const qs = params.toString();
  return `${base}/leads/export${qs ? `?${qs}` : ""}`;
}

export async function checkHealth(): Promise<{ status: string; demoMode?: boolean }> {
  const { data } = await api.get("/health");
  return data;
}

export default api;
