import { Link } from "react-router-dom";
import { MapPin, Phone, Globe, Star, ArrowRight, Check, X } from "lucide-react";
import type { Lead } from "../types/lead";
import { ScoreBadge } from "./ScoreBadge";
import { confidenceStyles, getRevenue } from "../utils/revenue";

interface Props {
  lead: Lead;
}

export function LeadCard({ lead }: Props) {
  const reasons = (lead.scoreReasons || []).slice(0, 3);
  const location = [lead.address?.city, lead.address?.state].filter(Boolean).join(", ");
  const revenue = getRevenue(lead);

  return (
    <article className="panel group flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md hover:shadow-accent/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {lead.ownerDetails?.ownerName && (
            <p className="mb-0.5 text-xs font-semibold text-accent">
              {lead.ownerDetails.ownerName}
              {lead.ownerDetails.ownerTitle
                ? ` · ${lead.ownerDetails.ownerTitle}`
                : ""}
            </p>
          )}
          <h3 className="truncate text-lg font-bold text-ink">{lead.name}</h3>
          {lead.category && (
            <p className="mt-0.5 text-sm font-medium text-ink-muted">{lead.category}</p>
          )}
        </div>
        <ScoreBadge score={lead.leadScore} priority={lead.priority} />
      </div>

      {revenue.label !== "Unknown" && (
        <p className="mt-2 text-sm text-ink">
          Est. revenue{" "}
          <span className="font-semibold">{revenue.label}</span>{" "}
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${confidenceStyles[revenue.confidence]}`}
          >
            {revenue.confidence}
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
        {lead.rating != null && (
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-warm text-warm" aria-hidden />
            {lead.rating} · {lead.reviewCount ?? 0} reviews
          </span>
        )}
        {location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {location}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
        {lead.phone ? (
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" aria-hidden />
            {lead.phone}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-danger">
            <X className="h-3.5 w-3.5" aria-hidden />
            No phone
          </span>
        )}
        {lead.website ? (
          <span className="inline-flex max-w-full items-center gap-1 truncate">
            <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{lead.website.replace(/^https?:\/\//, "")}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium text-accent">
            <X className="h-3.5 w-3.5" aria-hidden />
            No website
          </span>
        )}
      </div>

      {lead.primaryOpportunity && (
        <p className="mt-4 rounded-xl bg-gradient-to-r from-accent-soft to-warm-soft px-3 py-2 text-sm font-bold text-accent">
          {lead.primaryOpportunity}
        </p>
      )}

      <ul className="mt-3 space-y-1.5">
        {reasons.map((reason) => {
          const negative =
            /no |not |unavailable|lacks|missing/i.test(reason) ||
            reason.toLowerCase().includes("no website");
          return (
            <li key={reason} className="flex items-start gap-2 text-sm text-ink-muted">
              {negative ? (
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden />
              ) : (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
              )}
              <span>{reason}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-4">
        <Link to={`/leads/${lead._id}`} className="btn-primary w-full sm:w-auto">
          Verify lead
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
