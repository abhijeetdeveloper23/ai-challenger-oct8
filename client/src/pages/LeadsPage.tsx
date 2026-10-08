import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Columns3,
  Copy,
  Download,
  EyeOff,
  Gauge,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserSearch,
  Wallet,
  X,
} from "lucide-react";
import { useLeads } from "../hooks/useLeads";
import { LeadFiltersPanel } from "../components/LeadFilters";
import { LeadRow } from "../components/LeadRow";
import { LeadCard } from "../components/LeadCard";
import { LeadCardSkeleton } from "../components/Skeleton";
import { QuickFilters, countActiveFilters } from "../components/QuickFilters";
import { useToast } from "../components/Toast";
import { getExportUrl } from "../services/api";
import { downloadLeadsCsv } from "../utils/csv";
import { getRevenue } from "../utils/revenue";
import {
  setLastSearchId,
  setLeadStatuses,
  setNavList,
  useLeadStatuses,
} from "../utils/storage";
import type { Lead, LeadFilters } from "../types/lead";

const PAGE_SIZE = 50;
const SORTS = [
  { value: "score", label: "Best score" },
  { value: "revenue", label: "Est. revenue" },
  { value: "reviews", label: "Most reviews" },
  { value: "rating", label: "Highest rating" },
  { value: "name", label: "Name A–Z" },
];

const DEFAULT_COLUMNS: Record<string, boolean> = {
  industry: true,
  address: true,
  phone: true,
  website: true,
  rating: true,
  revenue: true,
  score: true,
};

/** Filters live in the URL so refresh, back and shared links keep the view. */
function filtersFromParams(params: URLSearchParams): LeadFilters {
  const num = (key: string): number | undefined => {
    const raw = params.get(key);
    if (raw === null || raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  const bool = (key: string): boolean | undefined => {
    const raw = params.get(key);
    return raw === "true" ? true : raw === "false" ? false : undefined;
  };
  const sort = params.get("sort");

  return {
    searchId: params.get("searchId") || undefined,
    q: params.get("q") || undefined,
    priority: params.get("priority") || undefined,
    city: params.get("city") || undefined,
    category: params.get("category") || undefined,
    opportunity: params.get("opportunity") || undefined,
    minScore: num("minScore"),
    hasWebsite: bool("hasWebsite"),
    hasPhone: bool("hasPhone"),
    hasEmail: bool("hasEmail"),
    sort: SORTS.some((s) => s.value === sort) ? (sort as string) : "score",
    page: num("page") ?? 1,
    limit: PAGE_SIZE,
  };
}

function paramsFromFilters(f: LeadFilters): URLSearchParams {
  const p = new URLSearchParams();
  (["searchId", "q", "priority", "city", "category", "opportunity"] as const).forEach(
    (key) => {
      const v = f[key];
      if (v) p.set(key, v);
    }
  );
  if (f.minScore !== undefined) p.set("minScore", String(f.minScore));
  (["hasWebsite", "hasPhone", "hasEmail"] as const).forEach((key) => {
    const v = f[key];
    if (v !== undefined) p.set(key, String(v));
  });
  if (f.sort && f.sort !== "score") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  return p;
}

export function LeadsPage() {
  const [params, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { notify } = useToast();
  const statuses = useLeadStatuses();

  const searchMeta = (location.state || {}) as {
    providers?: string[];
    isDemo?: boolean;
    product?: string | null;
  };

  const [initialFilters] = useState(() => filtersFromParams(params));
  const { filters, setFilters, updateFilters, data, loading, error, reload } =
    useLeads(initialFilters);

  const [qInput, setQInput] = useState(initialFilters.q ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [hideSkipped, setHideSkipped] = useState(true);
  const [selected, setSelected] = useState<Record<string, Lead>>({});
  const [visibleColumns, setVisibleColumns] =
    useState<Record<string, boolean>>(DEFAULT_COLUMNS);

  /* Keep the URL in step with the filters (one-way: state -> URL). */
  useEffect(() => {
    const next = paramsFromFilters(filters).toString();
    if (next !== params.toString()) {
      setSearchParams(next, { replace: true, state: location.state });
    }
  }, [filters, params, setSearchParams, location.state]);

  /* Remember the active search so the header "Results" link returns to it. */
  useEffect(() => {
    setLastSearchId(filters.searchId);
  }, [filters.searchId]);

  /* Debounced text search. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = qInput.trim() || undefined;
      if (next !== (filters.q || undefined)) updateFilters({ q: next });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [qInput, filters.q, updateFilters]);

  /* If filters are reset elsewhere, reflect that in the search box. */
  useEffect(() => {
    setQInput(filters.q ?? "");
  }, [filters.q]);

  const leads = useMemo(() => data?.leads ?? [], [data]);
  const visible = useMemo(
    () => (hideSkipped ? leads.filter((l) => statuses[l._id] !== "skipped") : leads),
    [leads, hideSkipped, statuses]
  );
  const hiddenCount = leads.length - visible.length;

  /* Feed the detail page's Previous / Next with exactly what the user sees. */
  const visibleKey = visible.map((l) => l._id).join(",");
  useEffect(() => {
    if (visibleKey) {
      setNavList(visibleKey.split(","), `${location.pathname}${location.search}`);
    }
  }, [visibleKey, location.pathname, location.search]);

  const total = data?.total ?? 0;
  const summary = data?.summary;
  const activeCount = countActiveFilters(filters);
  const exportHref = useMemo(() => getExportUrl(filters), [filters]);

  const selectedLeads = Object.values(selected);
  const selectedCount = selectedLeads.length;
  const allVisibleSelected =
    visible.length > 0 && visible.every((l) => selected[l._id]);

  function toggleSelect(lead: Lead) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[lead._id]) delete next[lead._id];
      else next[lead._id] = lead;
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = { ...prev };
      if (allVisibleSelected) {
        visible.forEach((l) => delete next[l._id]);
      } else {
        visible.forEach((l) => {
          next[l._id] = l;
        });
      }
      return next;
    });
  }

  function resetFilters() {
    setFilters({
      searchId: filters.searchId,
      limit: PAGE_SIZE,
      sort: "score",
      page: 1,
    });
  }

  function exportSelected() {
    downloadLeadsCsv(selectedLeads, `leads-selected-${selectedCount}.csv`);
    notify(`Exported ${selectedCount} lead${selectedCount === 1 ? "" : "s"}`);
  }

  async function copyPhones() {
    const phones = selectedLeads.map((l) => l.phone).filter((p): p is string => Boolean(p));
    if (phones.length === 0) {
      notify("None of the selected leads have a phone number", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(phones.join("\n"));
      notify(`${phones.length} phone number${phones.length === 1 ? "" : "s"} copied`);
    } catch {
      notify("Couldn't copy to the clipboard", "error");
    }
  }

  function markSelected(status: "shortlisted" | "skipped") {
    setLeadStatuses(
      selectedLeads.map((l) => l._id),
      status
    );
    notify(
      status === "shortlisted"
        ? `Shortlisted ${selectedCount} lead${selectedCount === 1 ? "" : "s"}`
        : `Skipped ${selectedCount} lead${selectedCount === 1 ? "" : "s"}`
    );
    setSelected({});
  }

  function goToEnrichment(action: "company" | "owners" = "company") {
    const ids = selectedLeads.slice(0, 25).map((l) => l._id);
    const qs = new URLSearchParams();
    if (filters.searchId) qs.set("searchId", filters.searchId);
    qs.set("ids", ids.join(","));
    qs.set("action", action);
    navigate(`/enrichment?${qs.toString()}`);
  }

  function goToPage(page: number) {
    updateFilters({ page });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const firstShown = total === 0 ? 0 : ((data?.page ?? 1) - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min((data?.page ?? 1) * PAGE_SIZE, total);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6">
      {/* Title + primary actions */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Search results</h1>
          <p className="mt-0.5 text-sm text-ink-muted" aria-live="polite">
            {loading && !data
              ? "Loading…"
              : `${total} lead${total === 1 ? "" : "s"}${activeCount ? " match your filters" : ""}`}
            {summary && total > 0
              ? ` · ${summary.hot} hot · ${summary.high} high`
              : ""}
            {searchMeta.product
              ? ` · offer: ${searchMeta.product}`
              : ""}
            {searchMeta.providers?.length
              ? ` · source: ${searchMeta.providers.join(" + ")}`
              : ""}
            {searchMeta.isDemo ? " · sample data" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/" className="btn-secondary">
            New search
          </Link>
          <a
            href={exportHref}
            className="btn-primary"
            aria-disabled={total === 0}
            title="Downloads every lead matching the current filters (up to 1,000)"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export {total > 0 ? Math.min(total, 1000) : ""} as CSV
          </a>
        </div>
      </div>

      {total > 0 && total < 50 && activeCount === 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-warm-soft px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between">
          <span>
            Only <strong>{total}</strong> leads found. We recommend a broader
            industry or nearby city for a larger pool.
          </span>
          <Link to="/" className="btn-primary shrink-0 text-xs">
            Find more leads
          </Link>
        </div>
      )}

      {/* Toolbar — mirrors ref: search, filters, revenue, scoring, columns */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search these results by name, category or city"
            aria-label="Search results"
            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="shrink-0">Sort</span>
          <select
            value={filters.sort ?? "score"}
            onChange={(e) => updateFilters({ sort: e.target.value })}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className="btn-secondary"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filters
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumns((v) => !v)}
            aria-expanded={showColumns}
            className="btn-secondary"
          >
            <Columns3 className="h-4 w-4" aria-hidden />
            Table settings
          </button>
          {showColumns && (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-border bg-white p-2 shadow-lg"
            >
              {Object.keys(DEFAULT_COLUMNS).map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[key]}
                    onChange={() =>
                      setVisibleColumns((prev) => ({
                        ...prev,
                        [key]: !prev[key],
                      }))
                    }
                    className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                  />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </label>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            const withRevenue = leads.filter(
              (l) => getRevenue(l).label !== "Unknown"
            ).length;
            notify(
              `Revenue estimated for ${withRevenue}/${leads.length} leads on this page (heuristic from reviews + category)`
            );
            if (!visibleColumns.revenue) {
              setVisibleColumns((prev) => ({ ...prev, revenue: true }));
            }
          }}
        >
          <Wallet className="h-4 w-4" aria-hidden />
          Estimate revenue
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            updateFilters({ sort: "score", minScore: 70 });
            notify("Showing scored leads ≥ 70 — our deterministic lead score");
          }}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Lead scoring
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            updateFilters({ sort: "score" });
            notify("Sorted by opportunity score (HOT → LOW)");
          }}
        >
          <Gauge className="h-4 w-4" aria-hidden />
          Rank by score
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <QuickFilters filters={filters} onChange={updateFilters} />
        {activeCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
          </button>
        )}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={hideSkipped}
            onChange={(e) => setHideSkipped(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Hide skipped{hiddenCount > 0 ? ` (${hiddenCount})` : ""}
        </label>
      </div>

      {showFilters && (
        <div className="mb-4">
          <LeadFiltersPanel
            filters={filters}
            onChange={updateFilters}
            onClear={resetFilters}
          />
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/30 bg-hot-bg px-4 py-3 text-sm"
        >
          <span className="font-medium text-danger">{error}</span>
          <button type="button" className="btn-secondary" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div
        aria-busy={loading}
        className={`hidden overflow-x-auto rounded-xl border border-border bg-surface-elevated shadow-sm transition-opacity md:block ${
          loading && data ? "opacity-60" : ""
        }`}
      >
        <table className="min-w-full text-left">
          <thead className="bg-header text-xs font-semibold uppercase tracking-wide text-white/90">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  disabled={visible.length === 0}
                  aria-label="Select all leads on this page"
                  className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
                />
              </th>
              <th className="px-3 py-3">Company</th>
              {visibleColumns.industry && (
                <th className="px-3 py-3">Industry</th>
              )}
              {visibleColumns.address && <th className="px-3 py-3">Address</th>}
              {visibleColumns.phone && <th className="px-3 py-3">Phone</th>}
              {visibleColumns.website && <th className="px-3 py-3">Website</th>}
              {visibleColumns.rating && <th className="px-3 py-3">Rating</th>}
              {visibleColumns.revenue && (
                <th className="px-3 py-3">Est. Revenue</th>
              )}
              {visibleColumns.score && <th className="px-3 py-3">Score</th>}
              <th className="px-3 py-3">Triage</th>
            </tr>
          </thead>
          <tbody className="bg-white text-sm">
            {loading &&
              !data &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i} className="border-b border-border/80">
                  <td colSpan={10} className="px-3 py-4">
                    <div className="h-5 w-full animate-pulse rounded bg-border/60" />
                  </td>
                </tr>
              ))}
            {visible.map((lead) => (
              <LeadRow
                key={lead._id}
                lead={lead}
                selected={Boolean(selected[lead._id])}
                onToggleSelect={toggleSelect}
                visibleColumns={visibleColumns}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {loading && !data && Array.from({ length: 3 }, (_, i) => <LeadCardSkeleton key={i} />)}
        {visible.map((lead) => (
          <LeadCard key={lead._id} lead={lead} />
        ))}
      </div>

      {/* Empty states */}
      {!loading && data && visible.length === 0 && (
        <div className="panel mt-4 px-4 py-10 text-center">
          {leads.length > 0 ? (
            <>
              <p className="font-semibold text-ink">
                Every lead on this page is skipped
              </p>
              <button
                type="button"
                className="btn-secondary mt-3"
                onClick={() => setHideSkipped(false)}
              >
                Show skipped leads
              </button>
            </>
          ) : activeCount > 0 ? (
            <>
              <p className="font-semibold text-ink">No leads match these filters</p>
              <p className="mt-1 text-sm text-ink-muted">
                Remove a filter to see more results.
              </p>
              <button type="button" className="btn-primary mt-3" onClick={resetFilters}>
                Clear all filters
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold text-ink">No leads in this search yet</p>
              <Link to="/" className="btn-primary mt-3">
                Start a new search
              </Link>
            </>
          )}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="mt-4 flex flex-wrap items-center justify-center gap-3"
        >
          <button
            type="button"
            className="btn-secondary"
            disabled={(filters.page || 1) <= 1 || loading}
            onClick={() => goToPage((filters.page || 1) - 1)}
          >
            Previous
          </button>
          <span className="text-sm text-ink-muted">
            {firstShown}–{lastShown} of {total}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={data.page >= data.totalPages || loading}
            onClick={() => goToPage((filters.page || 1) + 1)}
          >
            Next
          </button>
        </nav>
      )}

      <p className="mt-6 text-center text-xs text-ink-muted">
        Shortlist and skip choices are saved in this browser only.
      </p>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div
          role="region"
          aria-label="Actions for selected leads"
          className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-3xl flex-wrap items-center justify-between gap-2 rounded-xl bg-header px-4 py-3 text-white shadow-xl"
        >
          <span className="text-sm font-semibold">{selectedCount} selected</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => goToEnrichment("company")}
              title="Website emails, social links, booking signals"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Enrich company
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => goToEnrichment("owners")}
              title="Find owners / LinkedIn for outreach"
            >
              <UserSearch className="h-4 w-4" aria-hidden />
              Get Owner Details
            </button>
            <button type="button" className="btn-secondary" onClick={exportSelected}>
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </button>
            <button type="button" className="btn-secondary" onClick={() => void copyPhones()}>
              <Copy className="h-4 w-4" aria-hidden />
              Copy phones
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => markSelected("shortlisted")}
            >
              <Star className="h-4 w-4" aria-hidden />
              Shortlist
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => markSelected("skipped")}
            >
              <EyeOff className="h-4 w-4" aria-hidden />
              Skip
            </button>
            <button
              type="button"
              aria-label="Clear selection"
              title="Clear selection"
              onClick={() => setSelected({})}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
