import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  Columns3,
  Copy,
  Download,
  EyeOff,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserSearch,
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
  address: false,
  phone: true,
  website: true,
  rating: false,
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
    <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Results
          </h1>
          <p className="mt-1 min-h-[1.25rem] text-sm text-ink-muted" aria-live="polite">
            {loading && !data
              ? "Loading…"
              : `${total} lead${total === 1 ? "" : "s"}`}
            {summary && total > 0 ? ` · ${summary.hot} hot · ${summary.high} high` : ""}
            {searchMeta.product ? ` · ${searchMeta.product}` : ""}
            {total > 0 && total < 50 && activeCount === 0 ? (
              <>
                {" · "}
                <Link to="/" className="text-accent no-underline hover:underline">
                  broaden search
                </Link>
              </>
            ) : null}
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
            title="Download matching leads as CSV"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </a>
        </div>
      </div>

      {/* Toolbar in normal flow — filters expand below, never overlay the table */}
      <div className="mt-6 border-y border-border/70">
        <div className="flex min-h-[3.25rem] flex-col justify-center gap-2 py-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <input
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search by name, category, city…"
              aria-label="Search results"
              className="w-full border-0 bg-transparent py-1.5 pl-7 text-sm text-ink outline-none placeholder:text-ink-muted"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 lg:shrink-0">
            <label className="relative inline-flex items-center">
              <select
                value={filters.sort ?? "score"}
                onChange={(e) => updateFilters({ sort: e.target.value })}
                aria-label="Sort"
                className="appearance-none rounded-lg border-0 bg-transparent py-1.5 pl-2 pr-7 text-sm text-ink-muted outline-none hover:text-ink"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-0 h-3.5 w-3.5 text-ink-muted"
                aria-hidden
              />
            </label>

            <button
              type="button"
              onClick={() => {
                setShowColumns(false);
                setShowFilters((v) => !v);
              }}
              aria-expanded={showFilters}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${
                showFilters || activeCount > 0
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              Filters{activeCount > 0 ? ` (${activeCount})` : ""}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowFilters(false);
                  setShowColumns((v) => !v);
                }}
                aria-expanded={showColumns}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-muted hover:text-ink"
              >
                <Columns3 className="h-3.5 w-3.5" aria-hidden />
                Columns
              </button>
              {showColumns && (
                <div
                  role="menu"
                  className="absolute right-0 z-40 mt-1 w-48 rounded-xl border border-border bg-white p-2 shadow-lg"
                >
                  {Object.keys(DEFAULT_COLUMNS).map((key) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-surface"
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
          </div>
        </div>

        <div className="flex min-h-[2.25rem] flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 py-1.5">
          <QuickFilters filters={filters} onChange={updateFilters} />
          <span className="inline-flex min-w-[4.5rem]">
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Clear
              </button>
            ) : null}
          </span>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={hideSkipped}
              onChange={(e) => setHideSkipped(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--color-accent)]"
            />
            Hide skipped{hiddenCount > 0 ? ` (${hiddenCount})` : ""}
          </label>
        </div>

        {showFilters && (
          <div className="border-t border-border/50 py-3">
            <LeadFiltersPanel
              filters={filters}
              onChange={updateFilters}
              onClear={resetFilters}
            />
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-hot-bg px-4 py-3 text-sm"
        >
          <span className="font-medium text-danger">{error}</span>
          <button type="button" className="btn-secondary" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}

      {/* Desktop table — fixed layout keeps columns tight inside the panel */}
      <div
        aria-busy={loading}
        className="relative mt-4 hidden overflow-hidden rounded-2xl border border-border bg-white md:block"
      >
        {loading && data && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden">
            <div className="table-progress" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className="w-10" />
              <col className="w-[28%]" />
              {visibleColumns.industry && <col className="w-[14%]" />}
              {visibleColumns.address && <col className="w-[14%]" />}
              {visibleColumns.phone && <col className="w-[14%]" />}
              {visibleColumns.website && <col className="w-[8%]" />}
              {visibleColumns.rating && <col className="w-[10%]" />}
              {visibleColumns.revenue && <col className="w-[12%]" />}
              {visibleColumns.score && <col className="w-[10%]" />}
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border bg-surface/80 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    disabled={visible.length === 0}
                    aria-label="Select all leads on this page"
                    className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
                  />
                </th>
                <th className="px-2 py-3 font-semibold">Company</th>
                {visibleColumns.industry && (
                  <th className="px-2 py-3 font-semibold">Industry</th>
                )}
                {visibleColumns.address && (
                  <th className="px-2 py-3 font-semibold">Address</th>
                )}
                {visibleColumns.phone && (
                  <th className="px-2 py-3 font-semibold">Phone</th>
                )}
                {visibleColumns.website && (
                  <th className="px-2 py-3 font-semibold">Web</th>
                )}
                {visibleColumns.rating && (
                  <th className="px-2 py-3 font-semibold">Rating</th>
                )}
                {visibleColumns.revenue && (
                  <th className="px-2 py-3 font-semibold">Revenue</th>
                )}
                {visibleColumns.score && (
                  <th className="px-2 py-3 font-semibold">Score</th>
                )}
                <th className="px-2 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="text-sm">
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

      {selectedCount > 0 && (
        <div
          role="region"
          aria-label="Actions for selected leads"
          className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-2xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-xl"
        >
          <span className="text-sm font-medium text-ink">
            {selectedCount} selected
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="btn-secondary px-2.5 py-1.5 text-xs"
              onClick={() => goToEnrichment("company")}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Enrich
            </button>
            <button
              type="button"
              className="btn-primary px-2.5 py-1.5 text-xs"
              onClick={() => goToEnrichment("owners")}
            >
              <UserSearch className="h-3.5 w-3.5" aria-hidden />
              Owners
            </button>
            <button
              type="button"
              className="btn-secondary px-2.5 py-1.5 text-xs"
              onClick={exportSelected}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV
            </button>
            <button
              type="button"
              className="btn-secondary px-2.5 py-1.5 text-xs"
              onClick={() => void copyPhones()}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Phones
            </button>
            <button
              type="button"
              className="btn-secondary px-2.5 py-1.5 text-xs"
              onClick={() => markSelected("shortlisted")}
            >
              <Star className="h-3.5 w-3.5" aria-hidden />
              Shortlist
            </button>
            <button
              type="button"
              className="btn-secondary px-2.5 py-1.5 text-xs"
              onClick={() => markSelected("skipped")}
            >
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
              Skip
            </button>
            <button
              type="button"
              aria-label="Clear selection"
              onClick={() => setSelected({})}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
