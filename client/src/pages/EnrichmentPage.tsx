import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Loader2,
  Sparkles,
  UserSearch,
} from "lucide-react";
import { enrichCompanies, enrichOwners, fetchLeads } from "../services/api";
import type { Lead } from "../types/lead";
import { useToast } from "../components/Toast";
import { confidenceStyles } from "../utils/revenue";

const MAX_SELECT = 25;

/** Only rows with at least one useful owner signal — hide empty "Not found" noise. */
function hasFoundOwner(lead: Lead): boolean {
  const o = lead.ownerDetails;
  if (!o) return false;
  return Boolean(
    o.ownerName?.trim() ||
      o.ownerLinkedIn?.trim() ||
      o.companyLinkedIn?.trim() ||
      o.parentCompany?.trim()
  );
}

function hasCompanyEnrichment(lead: Lead): boolean {
  return Boolean(lead.companyEnrichment);
}

function socialSummary(lead: Lead): string {
  const s = lead.companyEnrichment?.socialLinks || {};
  return [s.linkedin && "LI", s.facebook && "FB", s.instagram && "IG", s.twitter && "X"]
    .filter(Boolean)
    .join(" · ") || "—";
}

function addressParts(lead: Lead) {
  return {
    street: lead.address?.street || "—",
    city: lead.address?.city || "—",
    state: lead.address?.state || "—",
  };
}

function downloadOwnerCsv(leads: Lead[]) {
  const header = [
    "Company",
    "Owner",
    "Owner Title",
    "Company LinkedIn",
    "Owner LinkedIn",
    "Parent Company",
    "Affiliated Companies",
    "Ownership Type",
    "Confidence",
    "Sources",
  ];
  const rows = leads.map((l) => {
    const o = l.ownerDetails;
    const cells = [
      l.name,
      o?.ownerName || "Not found",
      o?.ownerTitle || "",
      o?.companyLinkedIn || "",
      o?.ownerLinkedIn || "",
      o?.parentCompany || "",
      (o?.affiliatedCompanies || []).join("; "),
      o?.ownershipType || "",
      o?.confidence || "",
      (o?.sources || []).join("; "),
    ];
    return cells
      .map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
      .join(",");
  });
  const blob = new Blob([[header.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `owner-details-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EnrichmentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const searchId = params.get("searchId") || undefined;
  const preselectIds = useMemo(
    () => (params.get("ids") || "").split(",").filter(Boolean),
    [params]
  );

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<"owners" | "company" | null>(null);
  const [ownerRows, setOwnerRows] = useState<Lead[]>([]);
  const [companyRows, setCompanyRows] = useState<Lead[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLeads({
        searchId,
        limit: 100,
        sort: "score",
        page: 1,
      });
      setLeads(res.leads);
      const next: Record<string, boolean> = {};
      const preset = new Set(preselectIds);
      res.leads.forEach((l, i) => {
        if (preset.size > 0) {
          if (preset.has(l._id) && Object.keys(next).length < MAX_SELECT) {
            next[l._id] = true;
          }
        } else if (i < Math.min(7, MAX_SELECT)) {
          next[l._id] = true;
        }
      });
      setSelected(next);
      setOwnerRows(res.leads.filter(hasFoundOwner));
      setCompanyRows(res.leads.filter(hasCompanyEnrichment));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }, [searchId, preselectIds]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return leads;
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(needle) ||
        (l.category || "").toLowerCase().includes(needle) ||
        (l.address?.city || "").toLowerCase().includes(needle)
    );
  }, [leads, q]);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const selectedCount = selectedIds.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
        return next;
      }
      if (Object.keys(next).length >= MAX_SELECT) {
        notify(`You can enrich at most ${MAX_SELECT} companies at once`, "error");
        return prev;
      }
      next[id] = true;
      return next;
    });
  }

  function toggleAllVisible() {
    const allOn =
      filtered.length > 0 && filtered.every((l) => selected[l._id]);
    setSelected((prev) => {
      const next = { ...prev };
      if (allOn) {
        filtered.forEach((l) => delete next[l._id]);
      } else {
        for (const l of filtered) {
          if (Object.keys(next).length >= MAX_SELECT) break;
          next[l._id] = true;
        }
      }
      return next;
    });
  }

  function mergeLeads(enriched: Lead[]) {
    setLeads((prev) => {
      const map = new Map(enriched.map((l) => [l._id, l]));
      return prev.map((l) => map.get(l._id) || l);
    });
  }

  async function runOwnerEnrichment() {
    if (selectedCount === 0) {
      notify("Select at least one company", "error");
      return;
    }
    setBusy("owners");
    try {
      const { leads: enriched, failed } = await enrichOwners(selectedIds);
      mergeLeads(enriched);
      const found = enriched.filter(hasFoundOwner);
      setOwnerRows(found);
      notify(
        found.length === 0
          ? `No public owners found for ${enriched.length} selected`
          : failed > 0
            ? `Found owners for ${found.length} of ${enriched.length}`
            : `Owner details ready for ${found.length}`
      );
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Owner lookup failed",
        "error"
      );
    } finally {
      setBusy(null);
    }
  }

  async function runCompanyEnrichment() {
    if (selectedCount === 0) {
      notify("Select at least one company", "error");
      return;
    }
    setBusy("company");
    try {
      const { leads: enriched, failed } = await enrichCompanies(selectedIds);
      mergeLeads(enriched);
      const done = enriched.filter(hasCompanyEnrichment);
      setCompanyRows(done);
      const withEmail = done.filter((l) => (l.companyEnrichment?.emails.length || 0) > 0).length;
      notify(
        failed > 0
          ? `Company data updated for ${done.length - failed} of ${enriched.length}`
          : `Enriched ${done.length} companies · ${withEmail} with email found`
      );
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Company enrichment failed",
        "error"
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to={searchId ? `/leads?searchId=${searchId}` : "/leads"}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted no-underline hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to results
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-ink">Enhancement</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Two different jobs: <strong>Enrich</strong> pulls company website
            data (email, social, booking). <strong>Get Owner Details</strong>{" "}
            finds decision-makers for outreach.
          </p>
        </div>
        <Link to="/" className="btn-secondary shrink-0">
          Finish and go home
        </Link>
      </div>

      {/* Companies */}
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Companies</h2>
            <p className="text-xs text-ink-muted">
              Select companies to enrich with additional data.
            </p>
          </div>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search companies…"
            aria-label="Search companies"
            className="w-full max-w-xs rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent sm:w-56"
          />
        </div>

        {error && (
          <p className="px-4 py-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-header text-xs font-semibold uppercase tracking-wide text-white/90">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={
                      filtered.length > 0 &&
                      filtered.every((l) => selected[l._id])
                    }
                    onChange={toggleAllVisible}
                    aria-label="Select all visible"
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                </th>
                <th className="px-3 py-3">Company</th>
                <th className="px-3 py-3">Industry</th>
                <th className="px-3 py-3">Street</th>
                <th className="px-3 py-3">City</th>
                <th className="px-3 py-3">State</th>
                <th className="px-3 py-3">Phone</th>
                <th className="px-3 py-3">Website</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading &&
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-b border-border/80">
                    <td colSpan={8} className="px-3 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-border/60" />
                    </td>
                  </tr>
                ))}
              {!loading &&
                filtered.map((lead) => {
                  const addr = addressParts(lead);
                  return (
                    <tr
                      key={lead._id}
                      className={`border-b border-border/80 ${
                        selected[lead._id] ? "bg-accent-soft/40" : ""
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[lead._id])}
                          onChange={() => toggle(lead._id)}
                          aria-label={`Select ${lead.name}`}
                          className="h-4 w-4 accent-[var(--color-accent)]"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-ink">
                        {lead.name}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {lead.category || "—"}
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2.5 text-ink-muted">
                        {addr.street}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">{addr.city}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{addr.state}</td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {lead.phone || "N/A"}
                      </td>
                      <td className="px-3 py-2.5">
                        {lead.website ? (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-accent no-underline hover:underline"
                          >
                            Site
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        ) : (
                          <span className="text-ink-muted">N/A</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-10 text-center text-ink-muted"
                  >
                    {leads.length === 0
                      ? "No companies in this search yet. Run a search first."
                      : "No companies match this filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted">
            Showing {filtered.length} of {leads.length} · {selectedCount} of{" "}
            {leads.length} selected (Max: {MAX_SELECT})
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy !== null || selectedCount === 0}
              onClick={() => void runCompanyEnrichment()}
              title="Scrape websites for email, phone, social links, booking signals"
            >
              {busy === "company" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              Enrich company data
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy !== null || selectedCount === 0}
              onClick={() => void runOwnerEnrichment()}
              title="Look up owners / founders and LinkedIn profiles"
            >
              {busy === "owners" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <UserSearch className="h-4 w-4" aria-hidden />
              )}
              Get Owner Details
            </button>
          </div>
        </div>
      </section>

      {/* Company enrichment results */}
      <section className="panel mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Company Data</h2>
            <p className="text-xs text-ink-muted">
              From <strong>Enrich company data</strong> — emails, phones, social,
              booking / form signals.
            </p>
          </div>
        </div>

        {busy === "company" && (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Scraping websites for {selectedCount} companies…
          </div>
        )}

        {busy !== "company" && companyRows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            Click <strong>Enrich company data</strong> to pull contact + web
            signals (not owner names).
          </p>
        )}

        {companyRows.length > 0 && busy !== "company" && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-header text-xs font-semibold uppercase tracking-wide text-white/90">
                <tr>
                  <th className="px-3 py-3">Company</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Social</th>
                  <th className="px-3 py-3">Booking</th>
                  <th className="px-3 py-3">Form</th>
                  <th className="px-3 py-3">Est. Revenue</th>
                  <th className="px-3 py-3">AI profile</th>
                  <th className="px-3 py-3">Sources</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {companyRows.map((lead) => {
                  const c = lead.companyEnrichment;
                  return (
                    <tr key={lead._id} className="border-b border-border/80">
                      <td className="px-3 py-2.5 font-medium text-ink">
                        {lead.name}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {c?.emails?.[0] || lead.email || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {c?.phones?.[0] || lead.phone || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {socialSummary(lead)}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {c?.hasBooking ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {c?.hasContactForm ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {lead.estimatedRevenue?.label || "—"}
                      </td>
                      <td className="max-w-[220px] px-3 py-2.5 text-xs text-ink-muted">
                        <span className="line-clamp-2">
                          {c?.aiProfile || "—"}
                        </span>
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2.5 text-xs text-ink-muted">
                        {(c?.sources || []).join(" · ") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Owner details */}
      <section className="panel mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Owner Details</h2>
            <p className="text-xs text-ink-muted">
              From <strong>Get Owner Details</strong> — decision-makers and
              LinkedIn for outreach.
            </p>
          </div>
          {ownerRows.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                downloadOwnerCsv(ownerRows);
                notify("Owner details CSV downloaded");
              }}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export
            </button>
          )}
        </div>

        {busy === "owners" && (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Looking up public owner signals for {selectedCount} companies…
          </div>
        )}

        {busy !== "owners" && ownerRows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            Click <strong>Get Owner Details</strong>. Only companies with a found
            owner or LinkedIn appear here.
          </p>
        )}

        {ownerRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-header text-xs font-semibold uppercase tracking-wide text-white/90">
                <tr>
                  <th className="px-3 py-3">Company</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Company LinkedIn</th>
                  <th className="px-3 py-3">Owner LinkedIn</th>
                  <th className="px-3 py-3">Parent Company</th>
                  <th className="px-3 py-3">Affiliated</th>
                  <th className="px-3 py-3">Ownership</th>
                  <th className="px-3 py-3">Confidence</th>
                  <th className="px-3 py-3">Sources</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {ownerRows.map((lead) => {
                  const o = lead.ownerDetails;
                  const conf = o?.confidence || "low";
                  return (
                    <tr key={lead._id} className="border-b border-border/80">
                      <td className="px-3 py-2.5 font-medium text-ink">
                        {lead.name}
                      </td>
                      <td className="px-3 py-2.5">
                        {o?.ownerName ? (
                          <span>
                            {o.ownerName}
                            {o.ownerTitle ? (
                              <span className="block text-xs text-ink-muted">
                                {o.ownerTitle}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {o?.companyLinkedIn ? (
                          <a
                            href={o.companyLinkedIn}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent no-underline hover:underline"
                          >
                            Profile
                          </a>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {o?.ownerLinkedIn ? (
                          <a
                            href={o.ownerLinkedIn}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent no-underline hover:underline"
                          >
                            Profile
                          </a>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {o?.parentCompany || "—"}
                      </td>
                      <td className="max-w-[120px] truncate px-3 py-2.5 text-ink-muted">
                        {(o?.affiliatedCompanies || []).join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {o?.ownershipType || "Other"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${confidenceStyles[conf]}`}
                        >
                          {conf}
                        </span>
                      </td>
                      <td className="max-w-[200px] px-3 py-2.5 text-xs text-ink-muted">
                        <span className="line-clamp-2">
                          {(o?.sources || []).join(" · ") ||
                            o?.notes ||
                            "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!searchId && leads.length === 0 && !loading && (
        <div className="mt-6 text-center">
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate("/")}
          >
            Start a search first
          </button>
        </div>
      )}
    </div>
  );
}
