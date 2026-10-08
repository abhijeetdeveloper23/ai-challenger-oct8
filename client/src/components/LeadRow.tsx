import { Link } from "react-router-dom";
import { ArrowUpRight, User } from "lucide-react";
import type { Lead } from "../types/lead";
import { ScoreBadge } from "./ScoreBadge";
import { LeadStatusToggle } from "./LeadStatusToggle";
import { useLeadStatuses } from "../utils/storage";
import { getRevenue } from "../utils/revenue";

interface Props {
  lead: Lead;
  selected: boolean;
  onToggleSelect: (lead: Lead) => void;
  visibleColumns: Record<string, boolean>;
}

function addressLine(lead: Lead): string {
  return (
    [lead.address?.city, lead.address?.state].filter(Boolean).join(", ") ||
    lead.address?.street ||
    "—"
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
  const owner = lead.ownerDetails?.ownerName?.trim();

  return (
    <tr
      className={`border-b border-border/60 transition-colors ${
        selected ? "bg-accent-soft/40" : "hover:bg-surface/60"
      } ${status === "skipped" ? "opacity-45" : ""}`}
    >
      <td
        className={`px-3 py-3 align-middle ${
          status === "shortlisted"
            ? "shadow-[inset_2px_0_0_0_var(--color-accent)]"
            : ""
        }`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(lead)}
          aria-label={`Select ${lead.name}`}
          className="h-4 w-4 cursor-pointer accent-[var(--color-accent)]"
        />
      </td>

      <td className="max-w-0 px-2 py-3 align-middle">
        {owner && (
          <p className="mb-0.5 flex min-w-0 items-center gap-1 truncate text-xs font-semibold text-accent">
            <User className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">
              {owner}
              {lead.ownerDetails?.ownerTitle
                ? ` · ${lead.ownerDetails.ownerTitle}`
                : ""}
            </span>
          </p>
        )}
        <Link
          to={`/leads/${lead._id}`}
          className="block truncate font-medium text-ink no-underline hover:text-accent"
          title={lead.name}
        >
          {lead.name}
        </Link>
        {lead.primaryOpportunity && (
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {lead.primaryOpportunity}
          </p>
        )}
      </td>

      {visibleColumns.industry && (
        <td className="truncate px-2 py-3 align-middle text-sm text-ink-muted">
          {lead.category || "—"}
        </td>
      )}

      {visibleColumns.address && (
        <td className="truncate px-2 py-3 align-middle text-sm text-ink-muted">
          {addressLine(lead)}
        </td>
      )}

      {visibleColumns.phone && (
        <td className="whitespace-nowrap px-2 py-3 align-middle text-sm">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
              className="text-ink no-underline hover:text-accent"
            >
              {lead.phone}
            </a>
          ) : (
            <span className="text-ink-muted">—</span>
          )}
        </td>
      )}

      {visibleColumns.website && (
        <td className="px-2 py-3 align-middle text-sm">
          {lead.website ? (
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-accent no-underline hover:underline"
            >
              Site
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : (
            <span className="text-ink-muted">—</span>
          )}
        </td>
      )}

      {visibleColumns.rating && (
        <td className="whitespace-nowrap px-2 py-3 align-middle text-sm text-ink-muted">
          {lead.rating != null
            ? `${lead.rating} (${lead.reviewCount ?? 0})`
            : "—"}
        </td>
      )}

      {visibleColumns.revenue && (
        <td
          className="whitespace-nowrap px-2 py-3 align-middle text-sm text-ink-muted"
          title={revenue.basis}
        >
          {revenue.label}
        </td>
      )}

      {visibleColumns.score && (
        <td className="px-2 py-3 align-middle">
          <ScoreBadge score={lead.leadScore} priority={lead.priority} />
        </td>
      )}

      <td className="px-2 py-3 align-middle">
        <div className="flex items-center justify-end gap-1">
          <LeadStatusToggle id={lead._id} name={lead.name} />
          <Link
            to={`/leads/${lead._id}`}
            className="rounded-lg px-2 py-1 text-xs font-medium text-accent no-underline hover:bg-accent-soft"
          >
            Open
          </Link>
        </div>
      </td>
    </tr>
  );
}
