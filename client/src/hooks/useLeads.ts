import { useState, useCallback, useEffect } from "react";
import { fetchLeads } from "../services/api";
import type { LeadFilters, LeadsResponse } from "../types/lead";

export function useLeads(initialFilters: LeadFilters = {}) {
  const [filters, setFilters] = useState<LeadFilters>(initialFilters);
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (next?: LeadFilters) => {
    const applied = next ?? filters;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLeads(applied);
      setData(response);
      return response;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } }; message?: string })
          ?.response?.data?.error ||
        (err as { message?: string })?.message ||
        "Failed to load leads";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load(filters);
  }, [filters, load]);

  const updateFilters = useCallback((patch: Partial<LeadFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));
  }, []);

  return { filters, setFilters, updateFilters, data, loading, error, reload: load };
}
