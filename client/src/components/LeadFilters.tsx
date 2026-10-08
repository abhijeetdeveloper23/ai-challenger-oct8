import { ChevronDown } from "lucide-react";
import type { LeadFilters as Filters } from "../types/lead";
import type { ReactNode, SelectHTMLAttributes } from "react";

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear?: () => void;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent";

function SelectField({
  label,
  children,
  ...props
}: {
  label: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block text-xs font-medium text-ink-muted">
      {label}
      <span className="relative mt-1 block">
        <select
          {...props}
          className="w-full appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-9 text-sm text-ink outline-none focus:border-accent"
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
      </span>
    </label>
  );
}

export function LeadFiltersPanel({ filters, onChange, onClear }: Props) {
  return (
    <section aria-label="Filters" className="bg-transparent">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Fine-tune
        </h2>
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
            className={inputClass}
            placeholder="70"
          />
        </label>
        <SelectField
          label="Priority"
          value={filters.priority ?? ""}
          onChange={(e) => onChange({ priority: e.target.value || undefined })}
        >
          <option value="">All</option>
          <option value="HOT">HOT</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </SelectField>
        <SelectField
          label="Opportunity"
          value={filters.opportunity ?? ""}
          onChange={(e) => onChange({ opportunity: e.target.value || undefined })}
        >
          <option value="">All</option>
          <option value="no-website">No website</option>
          <option value="no-online-booking">No booking</option>
          <option value="website-unavailable">Site down</option>
          <option value="high-rating">High rating</option>
        </SelectField>
        <SelectField
          label="Website"
          value={
            filters.hasWebsite === undefined ? "" : filters.hasWebsite ? "true" : "false"
          }
          onChange={(e) =>
            onChange({
              hasWebsite:
                e.target.value === "" ? undefined : e.target.value === "true",
            })
          }
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </SelectField>
        <SelectField
          label="Phone"
          value={
            filters.hasPhone === undefined ? "" : filters.hasPhone ? "true" : "false"
          }
          onChange={(e) =>
            onChange({
              hasPhone: e.target.value === "" ? undefined : e.target.value === "true",
            })
          }
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </SelectField>
        <SelectField
          label="Email"
          value={
            filters.hasEmail === undefined ? "" : filters.hasEmail ? "true" : "false"
          }
          onChange={(e) =>
            onChange({
              hasEmail: e.target.value === "" ? undefined : e.target.value === "true",
            })
          }
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </SelectField>
      </div>
    </section>
  );
}
