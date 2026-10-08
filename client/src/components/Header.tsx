import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  Menu,
  Search,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import { getLastSearchId } from "../utils/storage";

const NAV = [
  { to: "/", label: "Home", match: (p: string) => p === "/" },
  {
    to: "results",
    label: "Results",
    match: (p: string) => p.startsWith("/leads"),
  },
  {
    to: "enrich",
    label: "Enrich",
    match: (p: string) => p.startsWith("/enrichment"),
  },
] as const;

export function Header() {
  const { pathname } = useLocation();
  const lastSearchId = getLastSearchId();
  const resultsTo = lastSearchId ? `/leads?searchId=${lastSearchId}` : "/leads";
  const enrichTo = lastSearchId
    ? `/enrichment?searchId=${lastSearchId}`
    : "/enrichment";
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setResearchOpen(false);
  }, [pathname]);

  function resolveTo(key: string) {
    if (key === "results") return resultsTo;
    if (key === "enrich") return enrichTo;
    return key;
  }

  const researchActive =
    pathname.startsWith("/leads") || pathname.startsWith("/enrichment");

  return (
    <header
      className={`site-header sticky top-0 z-50 text-white transition-[box-shadow,background] duration-300 ${
        scrolled ? "site-header--scrolled" : ""
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="group flex items-center gap-2.5 no-underline"
          aria-label="Lead Intelligence home"
        >
          <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-accent text-sm font-bold text-white shadow-lg shadow-accent/30 transition-transform duration-300 group-hover:scale-105">
            <span className="absolute inset-0 bg-gradient-to-br from-white/25 to-transparent" />
            LI
          </span>
          <div className="leading-tight">
            <span className="font-display block text-[15px] font-semibold tracking-tight text-white">
              Lead Intelligence
            </span>
            <span className="hidden text-[11px] text-white/45 sm:block">
              Opportunity-first leads
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav
          className="hidden items-center gap-1 text-sm md:flex"
          aria-label="Primary"
        >
          <Link
            to="/"
            className={`nav-pill ${pathname === "/" ? "nav-pill--active" : ""}`}
          >
            Home
          </Link>

          <div
            className="relative"
            onMouseEnter={() => setResearchOpen(true)}
            onMouseLeave={() => setResearchOpen(false)}
          >
            <button
              type="button"
              className={`nav-pill inline-flex items-center gap-1 ${
                researchActive ? "nav-pill--active" : ""
              }`}
              aria-expanded={researchOpen}
              aria-haspopup="menu"
              onClick={() => setResearchOpen((v) => !v)}
            >
              Research
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  researchOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>
            {researchOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-30 min-w-[200px] pt-2"
              >
                <div className="overflow-hidden rounded-xl border border-white/10 bg-header/95 p-1.5 shadow-xl backdrop-blur-xl">
                  <Link
                    role="menuitem"
                    to={resultsTo}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-white/80 no-underline transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Table2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>
                      <span className="block text-sm font-semibold">Results</span>
                      <span className="block text-xs text-white/45">
                        Scored company table
                      </span>
                    </span>
                  </Link>
                  <Link
                    role="menuitem"
                    to={enrichTo}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-white/80 no-underline transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-warm" />
                    <span>
                      <span className="block text-sm font-semibold">Enrich</span>
                      <span className="block text-xs text-white/45">
                        Company data & owner lookup
                      </span>
                    </span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            to="/"
            className="ml-2 inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-white no-underline shadow-md shadow-accent/25 transition-all hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/30"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            New search
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-header/98 px-4 py-3 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV.map((item) => {
              const to = resolveTo(item.to);
              const active = item.match(pathname);
              return (
                <Link
                  key={item.label}
                  to={to}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium no-underline ${
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/"
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-white no-underline"
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              New search
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
