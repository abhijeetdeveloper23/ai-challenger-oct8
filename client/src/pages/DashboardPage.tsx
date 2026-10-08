import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useSearch } from "../hooks/useSearch";
import { SummaryCards } from "../components/SummaryCards";
import { SuggestInput } from "../components/SuggestInput";
import { SearchProgress } from "../components/SearchProgress";
import { fetchLeads } from "../services/api";
import {
  INDUSTRY_SUGGESTIONS,
  LOCATION_SUGGESTIONS,
  PRODUCT_SUGGESTIONS,
} from "../data/suggestions";
import {
  addRecentSearch,
  getRecentSearches,
  setLastSearchId,
  type RecentSearch,
} from "../utils/storage";
import type { LeadSummary } from "../types/lead";

const EXAMPLES: RecentSearch[] = [
  { query: "Dentist", location: "Indore", product: "Website development" },
  { query: "Gym", location: "Austin, TX", product: "Online booking" },
  { query: "Restaurant", location: "Pune", product: "Digital marketing" },
  { query: "Salon", location: "Bengaluru" },
];

const STEPS = [
  { title: "Search", body: "Industry, place, and optionally what you sell." },
  { title: "Review", body: "Leads ranked for your offer with reasons." },
  { title: "Enrich", body: "Pull owner details, then export the shortlist." },
];

export function DashboardPage() {
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [product, setProduct] = useState("");
  const [showProduct, setShowProduct] = useState(false);
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [recent, setRecent] = useState<RecentSearch[]>(() => getRecentSearches());
  const { search, loading, error } = useSearch();
  const navigate = useNavigate();
  const dockRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLeads({ limit: 1 });
        if (!cancelled) setSummary(data.summary);
      } catch {
        if (!cancelled) {
          setSummary({
            total: 0,
            hot: 0,
            high: 0,
            medium: 0,
            low: 0,
            opportunities: 0,
          });
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ⌘/Ctrl + K focuses the search dock */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = dockRef.current?.querySelector<HTMLInputElement>(
          'input[role="combobox"]'
        );
        input?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function runSearch(
    nextIndustry: string,
    nextLocation: string,
    nextProduct?: string
  ) {
    const i = nextIndustry.trim();
    const l = nextLocation.trim();
    const p = (nextProduct ?? product).trim();
    if (i.length < 2 || l.length < 2) return;
    setIndustry(i);
    setLocation(l);
    setProduct(p);
    if (p) setShowProduct(true);
    try {
      const data = await search(i, l, p || undefined);
      addRecentSearch(i, l, p || undefined);
      setRecent(getRecentSearches());
      setLastSearchId(data.searchId);
      navigate(`/leads?searchId=${data.searchId}`, {
        state: {
          providers: data.providers,
          failedProviders: data.failedProviders,
          isDemo: data.isDemo,
          product: data.product || p || null,
        },
      });
    } catch {
      // useSearch already stored a readable message in `error`.
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void runSearch(industry, location, product);
  }

  const hasHistory = (summary?.total ?? 0) > 0;
  const canSubmit = industry.trim().length >= 2 && location.trim().length >= 2;

  return (
    <div className="relative overflow-hidden">
      <div className="hero-atmosphere" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 sm:pt-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="animate-fade-up inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-white/70 px-3 py-1 text-xs font-semibold text-ink-muted backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
            Opportunity-first lead search
          </p>
          <h1 className="animate-fade-up font-display mt-4 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Lead Intelligence
          </h1>
          <p className="animate-fade-up mx-auto mt-3 max-w-xl text-base text-ink-muted sm:text-lg">
            Search local businesses and see which ones are most worth contacting —
            scored, explained, ready to enrich.
          </p>
        </div>

        {/* Smart search dock */}
        <form
          ref={dockRef}
          onSubmit={onSubmit}
          aria-busy={loading}
          className="animate-fade-up search-dock mx-auto mt-8 max-w-4xl"
        >
          <div className="relative z-20 flex flex-col gap-0 lg:flex-row lg:items-stretch">
            <div className="relative z-20 flex min-w-0 flex-1 flex-col gap-4 p-4 sm:flex-row sm:gap-0 sm:p-5">
              <SuggestInput
                label="Industry"
                value={industry}
                onChange={setIndustry}
                suggestions={INDUSTRY_SUGGESTIONS}
                placeholder="Dentist, Gym, Restaurant…"
                required
                variant="dock"
                icon={<Briefcase className="h-4 w-4" aria-hidden />}
              />
              <div className="hidden w-px self-stretch bg-border sm:mx-4 sm:block" />
              <div className="h-px bg-border sm:hidden" />
              <SuggestInput
                label="Location"
                value={location}
                onChange={setLocation}
                suggestions={LOCATION_SUGGESTIONS}
                placeholder="Indore, Austin, TX…"
                required
                variant="dock"
                icon={<MapPin className="h-4 w-4" aria-hidden />}
              />
            </div>

            <div className="flex items-center gap-2 border-t border-border p-3 sm:justify-end lg:border-l lg:border-t-0 lg:p-4">
              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="btn-primary h-11 w-full px-6 sm:w-auto lg:min-w-[148px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Searching…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" aria-hidden />
                    Find leads
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="relative z-0 flex flex-wrap items-center justify-between gap-2 rounded-b-[1.25rem] border-t border-border/80 bg-warm-soft/40 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {!showProduct ? (
                <button
                  type="button"
                  onClick={() => setShowProduct(true)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add what you sell
                </button>
              ) : (
                <div className="w-full max-w-md sm:w-72">
                  <SuggestInput
                    label="Your offer (optional)"
                    value={product}
                    onChange={setProduct}
                    suggestions={PRODUCT_SUGGESTIONS}
                    placeholder="Website, booking, CRM…"
                    variant="dock"
                  />
                </div>
              )}
            </div>
            <p className="hidden text-[11px] text-ink-muted sm:block">
              <kbd className="rounded border border-border bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold">
                ⌘K
              </kbd>{" "}
              to focus search
            </p>
          </div>

          {loading && (
            <div className="border-t border-border px-4 pb-4">
              <SearchProgress
                industry={industry}
                location={location}
                product={product}
              />
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="border-t border-danger/20 bg-hot-bg px-4 py-3 text-sm text-ink"
            >
              <p className="font-semibold text-danger">Search didn’t complete</p>
              <p className="mt-0.5">{error}</p>
            </div>
          )}
        </form>

        {!loading && (
          <div className="mx-auto mt-6 grid max-w-4xl gap-5 md:grid-cols-2">
            <section aria-labelledby="try-heading">
              <h2
                id="try-heading"
                className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted"
              >
                Try an example
              </h2>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={`${ex.query}-${ex.location}`}
                    type="button"
                    className="chip"
                    onClick={() =>
                      void runSearch(ex.query, ex.location, ex.product)
                    }
                  >
                    {ex.query} in {ex.location}
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </button>
                ))}
              </div>
            </section>

            {recent.length > 0 && (
              <section aria-labelledby="recent-heading">
                <h2
                  id="recent-heading"
                  className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted"
                >
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  Recent
                </h2>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={`${r.query}-${r.location}-${r.product || ""}`}
                      type="button"
                      className="chip"
                      onClick={() =>
                        void runSearch(r.query, r.location, r.product)
                      }
                    >
                      {r.query} in {r.location}
                      {r.product ? ` · ${r.product}` : ""}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {!hasHistory && !summaryLoading && !loading && (
          <ol className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="panel flex gap-3 p-4 transition-transform duration-300 hover:-translate-y-0.5"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-sm font-bold text-accent"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{step.title}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {(hasHistory || summaryLoading) && (
          <div className="mx-auto mt-12 max-w-4xl">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Pipeline so far
            </h2>
            <SummaryCards summary={summary} loading={summaryLoading} />
          </div>
        )}
      </div>
    </div>
  );
}
