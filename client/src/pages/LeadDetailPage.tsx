import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  Sparkles,
  ExternalLink,
  Phone,
  Mail,
  Globe,
  MapPin,
  Star,
  DollarSign,
  User,
} from "lucide-react";
import { fetchInsight, fetchLead } from "../services/api";
import type { AiBrief, Lead } from "../types/lead";
import { ScoreBadge } from "../components/ScoreBadge";
import { ScoreBreakdownBars } from "../components/ScoreBreakdown";
import { getRevenue } from "../utils/revenue";

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<AiBrief | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchLead(id);
        if (!cancelled) {
          setLead(data);
          if (data.aiBrief?.businessSummary) setBrief(data.aiBrief);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            (err as { response?: { data?: { error?: string } } })?.response?.data
              ?.error || "Failed to load lead"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function runGenerate() {
    if (!id) return;
    setInsightLoading(true);
    try {
      const { brief: next } = await fetchInsight(id);
      setBrief(next);
      setLead((prev) => (prev ? { ...prev, aiBrief: next } : prev));
    } catch {
      setBrief({
        businessSummary: "Could not generate the approach guide.",
        whyUseful: "",
        approachSteps: [],
        talkingPoints: [],
        pitchAngle: "",
      });
    } finally {
      setInsightLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-accent" aria-label="Loading" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-danger">{error || "Lead not found"}</p>
        <Link to="/leads" className="mt-3 inline-block text-accent">
          Back
        </Link>
      </div>
    );
  }

  const wa = lead.websiteAnalysis;
  const revenue = getRevenue(lead);
  const address = [
    lead.address?.street,
    lead.address?.city,
    lead.address?.state,
  ]
    .filter(Boolean)
    .join(", ");
  const resultsHref = lead.searchId
    ? `/leads?searchId=${lead.searchId}`
    : "/leads";
  const enrichHref = lead.searchId
    ? `/enrichment?searchId=${lead.searchId}&ids=${lead._id}`
    : "/enrichment";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        to={resultsHref}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted no-underline hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to results
      </Link>

      {/* Title row */}
      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              {lead.name}
            </h1>
            <ScoreBadge score={lead.leadScore} priority={lead.priority} size="lg" />
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            {[lead.category, lead.address?.city, lead.primaryOpportunity]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={enrichHref} className="btn-secondary">
            Enrich
          </Link>
          <button
            type="button"
            className="btn-primary"
            disabled={insightLoading}
            onClick={() => void runGenerate()}
          >
            {insightLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {brief ? "Refresh guide" : "AI approach guide"}
          </button>
        </div>
      </header>

      {/* Light contact strip */}
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-y border-border/70 py-4 text-sm text-ink">
        <Fact icon={MapPin} label={address || "No address"} />
        <Fact
          icon={Phone}
          label={lead.phone || "No phone"}
          href={lead.phone ? `tel:${lead.phone.replace(/[^\d+]/g, "")}` : undefined}
        />
        <Fact icon={Mail} label={lead.email || "No email"} />
        <Fact
          icon={Globe}
          label={
            lead.website
              ? lead.website.replace(/^https?:\/\//, "")
              : "No website"
          }
          href={lead.website}
          external
        />
        <Fact
          icon={Star}
          label={
            lead.rating != null
              ? `${lead.rating} · ${lead.reviewCount ?? 0} reviews`
              : "No rating"
          }
        />
        <Fact
          icon={DollarSign}
          label={
            revenue.label !== "Unknown"
              ? `${revenue.label} (${revenue.confidence})`
              : "Revenue unknown"
          }
        />
        <Fact
          icon={User}
          label={lead.ownerDetails?.ownerName || "Owner unknown"}
        />
      </div>

      {/* AI guide — light, primary content */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              AI approach guide
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              How to talk to this lead — summary, pitch, and next steps
            </p>
          </div>
          {brief && (
            <button
              type="button"
              className="text-sm font-medium text-accent hover:underline disabled:opacity-60"
              disabled={insightLoading}
              onClick={() => void runGenerate()}
            >
              {insightLoading ? "Refreshing…" : "Regenerate"}
            </button>
          )}
        </div>

        {!brief && !insightLoading && (
          <div className="mt-5 rounded-2xl border border-dashed border-border bg-white/60 px-6 py-10 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-accent" aria-hidden />
            <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted">
              Generate a short playbook: what this business is, why it fits your
              offer, and how to approach them.
            </p>
            <button
              type="button"
              className="btn-primary mt-5"
              onClick={() => void runGenerate()}
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Generate guide
            </button>
          </div>
        )}

        {insightLoading && !brief && (
          <div className="mt-5 flex items-center justify-center gap-2 py-12 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
            Writing your approach guide…
          </div>
        )}

        {brief && (
          <div className="mt-5 grid gap-8 lg:grid-cols-2">
            <div className="space-y-5">
              {brief.businessSummary && (
                <Block title="About">{brief.businessSummary}</Block>
              )}
              {brief.whyUseful && (
                <Block title="Why this lead">{brief.whyUseful}</Block>
              )}
              {brief.pitchAngle && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                    Opening pitch
                  </p>
                  <p className="mt-2 text-base font-medium leading-relaxed text-ink">
                    “{brief.pitchAngle}”
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {brief.approachSteps?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    How to approach
                  </p>
                  <ol className="mt-3 space-y-3">
                    {brief.approachSteps.map((step, i) => (
                      <li key={step} className="flex gap-3 text-sm text-ink">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-bold text-accent">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {brief.talkingPoints?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Talking points
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {brief.talkingPoints.map((point) => (
                      <li key={point} className="flex gap-2.5 text-sm text-ink">
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                          aria-hidden
                        />
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {brief?.model && (
          <p className="mt-6 text-[11px] text-ink-muted">
            {brief.model} · does not change the lead score
          </p>
        )}
      </section>

      {/* Score + opportunity — light split */}
      <div className="mt-10 grid gap-10 border-t border-border/70 pt-8 lg:grid-cols-2">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Score breakdown
          </h2>
          <div className="mt-4">
            <ScoreBreakdownBars breakdown={lead.scoreBreakdown} />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Opportunity
          </h2>
          <p className="mt-3 text-base font-semibold text-accent">
            {lead.primaryOpportunity || "General outreach"}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(lead.opportunities || []).map((o) => (
              <span
                key={o}
                className="rounded-full bg-white px-2.5 py-1 text-xs text-ink-muted ring-1 ring-border"
              >
                {o}
              </span>
            ))}
          </div>
          <ul className="mt-5 space-y-2">
            {(lead.scoreReasons || []).map((r) => (
              <li key={r} className="flex gap-2 text-sm text-ink">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                {r}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Website signals — chip row, no heavy card */}
      <section className="mt-10 border-t border-border/70 pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Website signals
        </h2>
        {!wa?.exists ? (
          <p className="mt-3 text-sm text-ink-muted">No website on file</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip ok={Boolean(wa.https)} label="HTTPS" />
            <Chip ok={Boolean(wa.reachable)} label="Reachable" />
            <Chip ok={Boolean(wa.hasViewport)} label="Mobile" />
            <Chip ok={Boolean(wa.hasEmail)} label="Email on site" />
            <Chip ok={Boolean(wa.hasBooking)} label="Booking" />
            <Chip ok={Boolean(wa.hasContactForm)} label="Contact form" />
            <Chip ok={Boolean(wa.hasSocialLinks)} label="Social" />
          </div>
        )}
      </section>

      {lead.companyEnrichment?.aiProfile && (
        <section className="mt-10 border-t border-border/70 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            AI business profile
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink">
            {lead.companyEnrichment.aiProfile}
          </p>
        </section>
      )}
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  href,
  external,
}: {
  icon: typeof Phone;
  label: string;
  href?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
      <span className="truncate">{label}</span>
      {external && href ? (
        <ExternalLink className="h-3 w-3 shrink-0 text-ink-muted" aria-hidden />
      ) : null}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className="inline-flex max-w-full items-center gap-1.5 text-ink no-underline hover:text-accent"
      >
        {inner}
      </a>
    );
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 text-ink-muted">
      {inner}
    </span>
  );
}

function Block({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink">{children}</p>
    </div>
  );
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        ok ? "bg-success/10 text-success" : "bg-white text-ink-muted ring-1 ring-border"
      }`}
    >
      {ok ? (
        <Check className="h-3 w-3" aria-hidden />
      ) : (
        <X className="h-3 w-3" aria-hidden />
      )}
      {label}
    </span>
  );
}
