import { Link } from "react-router-dom";
import { getLastSearchId } from "../utils/storage";

export function Footer() {
  const lastSearchId = getLastSearchId();
  const resultsTo = lastSearchId ? `/leads?searchId=${lastSearchId}` : "/leads";
  const enrichTo = lastSearchId
    ? `/enrichment?searchId=${lastSearchId}`
    : "/enrichment";
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
                LI
              </span>
              <span className="font-display text-base font-semibold tracking-tight text-white">
                Lead Intelligence
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">
              Find local businesses worth contacting — scored, enriched, and
              ready for outreach.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
              Product
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/" className="footer-link">
                  Search
                </Link>
              </li>
              <li>
                <Link to={resultsTo} className="footer-link">
                  Results
                </Link>
              </li>
              <li>
                <Link to={enrichTo} className="footer-link">
                  Enrichment
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
              Workflow
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/55">
              <li>Discover · multi-source</li>
              <li>Score · explainable 0–100</li>
              <li>Enrich · owner details</li>
              <li>Export · CSV ready</li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
              Stack
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/55">
              <li>React · Express · MongoDB</li>
              <li>SerpAPI · Places · Foursquare</li>
              <li>Heuristic scoring · optional AI</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/40">
            © {year} Lead Intelligence. Built for sales prioritization.
          </p>
          <p className="text-xs text-white/35">
            Scores are deterministic · AI never sets the numeric rank
          </p>
        </div>
      </div>
    </footer>
  );
}
