import type { LeadFilters as Filters } from "../types/lead";

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear?: () => void;
}

const field =
  "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export function LeadFiltersPanel({ filters, onChange, onClear }: Props) {
  return (
    <section
      aria-label="Filters"
      className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Filters</h2>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-accent hover:underline"
          >
            Reset
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="block text-xs font-medium text-ink-muted">
          Min score
          <input
            type="number"
            min={0}
            max={100}
            value={filters.minScore ?? ""}
            onChange={(e) =>
              onChange({
                minScore: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            className={`${field} mt-1`}
            placeholder="70"
          />
        </label>
        <label className="block text-xs font-medium text-ink-muted">
          Priority
          <select
            value={filters.priority ?? ""}
            onChange={(e) => onChange({ priority: e.target.value || undefined })}
            className={`${field} mt-1`}
          >
            <option value="">All</option>
            <option value="HOT">HOT</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-ink-muted">
          Opportunity
          <select
            value={filters.opportunity ?? ""}
            onChange={(e) => onChange({ opportunity: e.target.value || undefined })}
            className={`${field} mt-1`}
          >
            <option value="">All</option>
            <option value="no-website">No website</option>
            <option value="no-online-booking">No booking</option>
            <option value="website-unavailable">Site down</option>
            <option value="high-rating">High rating</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-ink-muted">
          Website
          <select
            value={
              filters.hasWebsite === undefined ? "" : filters.hasWebsite ? "true" : "false"
            }
            onChange={(e) =>
              onChange({
                hasWebsite:
                  e.target.value === "" ? undefined : e.target.value === "true",
              })
            }
            className={`${field} mt-1`}
          >
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-ink-muted">
          Phone
          <select
            value={
              filters.hasPhone === undefined ? "" : filters.hasPhone ? "true" : "false"
            }
            onChange={(e) =>
              onChange({
                hasPhone: e.target.value === "" ? undefined : e.target.value === "true",
              })
            }
            className={`${field} mt-1`}
          >
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-ink-muted">
          Email
          <select
            value={
              filters.hasEmail === undefined ? "" : filters.hasEmail ? "true" : "false"
            }
            onChange={(e) =>
              onChange({
                hasEmail: e.target.value === "" ? undefined : e.target.value === "true",
              })
            }
            className={`${field} mt-1`}
          >
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>
    </section>
  );
}
