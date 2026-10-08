import { useState, useCallback } from "react";
import { searchLeads } from "../services/api";
import type { SearchResponse } from "../types/lead";

export function useSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponse | null>(null);

  const search = useCallback(async (
    query: string,
    location: string,
    product?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const data = await searchLeads(query, location, product);
      setResult(data);
      return data;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } }; message?: string })
          ?.response?.data?.error ||
        (err as { message?: string })?.message ||
        "Search failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { search, loading, error, result, setResult, setError };
}
