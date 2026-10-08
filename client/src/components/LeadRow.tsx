import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import type { Lead } from "../types/lead";
import { ScoreBadge } from "./ScoreBadge";
import { LeadStatusToggle } from "./LeadStatusToggle";
import { useLeadStatuses } from "../utils/storage";
import { confidenceStyles, getRevenue } from "../utils/revenue";

interface Props {
  lead: Lead;
  selected: boolean;
  onToggleSelect: (lead: Lead) => void;
  visibleColumns: Record<string, boolean>;
}

function addressLine(lead: Lead): string {
  return (
    [lead.address?.street, lead.address?.city, lead.address?.state]
      .filter(Boolean)
      .join(", ") || "—"
  );
}

export function LeadRow({
  lead,
  selected,
  onToggleSelect,
  visibleColumns,
}: Props) {
  const status = useLeadStatuses()[lead._id];
  const revenue = getRevenue(lead);

  return (
    <tr
      className={`border-b border-border/80 transition-colors ${
        selected ? "bg-accent-soft/50" : "hover:bg-warm-soft/40"
      } ${status === "skipped" ? "opacity-50" : ""}`}
    >
      <td
        className={`w-10 px-3 py-3 align-top ${
          status === "shortlisted"
            ? "shadow-[inset_3px_0_0_0_var(--color-accent)]"
            : ""
        }`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(lead)}
          aria-label={`Select ${lead.name}`}
          className="mt-1 h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
        />
      </td>

      <td className="px-3 py-3 align-top">
        <Link
          to={`/leads/${lead._id}`}
          className="font-semibold text-ink no-underline hover:text-accent"
        >
          {lead.name}
        </Link>
        {lead.primaryOpportunity && (
          <p className="mt-1 text-xs text-accent">{lead.primaryOpportunity}</p>
        )}
      </td>

      {visibleColumns.industry && (
        <td className="px-3 py-3 align-top text-sm text-ink-muted">
          {lead.category || "—"}
        </td>
      )}

      {visibleColumns.address && (
        <td className="max-w-[200px] px-3 py-3 align-top text-sm text-ink-muted">
          <span className="line-clamp-2">{addressLine(lead)}</span>
        </td>
      )}

      {visibleColumns.phone && (
        <td className="px-3 py-3 align-top text-sm">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
              className="text-ink no-underline hover:text-accent"
            >
              {lead.phone}
            </a>
          ) : (
            <span className="text-ink-muted">N/A</span>
          )}
        </td>
      )}

      {visibleColumns.website && (
        <td className="px-3 py-3 align-top text-sm">
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
      )}

      {visibleColumns.rating && (
        <td className="px-3 py-3 align-top text-sm text-ink">
          {lead.rating != null ? (
            <span>
              {lead.rating}
              <span className="text-ink-muted"> ({lead.reviewCount ?? 0})</span>
            </span>
          ) : (
            <span className="text-ink-muted">N/A</span>
          )}
        </td>
      )}

      {visibleColumns.revenue && (
        <td className="px-3 py-3 align-top text-sm">
          <div className="font-medium text-ink">{revenue.label}</div>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${confidenceStyles[revenue.confidence]}`}
            title={revenue.basis}
          >
            {revenue.confidence} confidence
          </span>
        </td>
      )}

      {visibleColumns.score && (
        <td className="px-3 py-3 align-top">
          <ScoreBadge score={lead.leadScore} priority={lead.priority} />
        </td>
      )}

      <td className="px-3 py-3 align-top">
        <div className="flex items-center gap-2">
          <LeadStatusToggle id={lead._id} name={lead.name} />
          <Link
            to={`/leads/${lead._id}`}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Review
          </Link>
        </div>
      </td>
    </tr>
  );
}
