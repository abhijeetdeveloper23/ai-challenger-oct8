import type { LeadFilters } from "../types/lead";

interface Preset {
  id: string;
  label: string;
  hint: string;
  isActive: (f: LeadFilters) => boolean;
  apply: Partial<LeadFilters>;
  clear: Partial<LeadFilters>;
}

const PRESETS: Preset[] = [
  {
    id: "hot",
    label: "Hot",
    hint: "Score 85 and above",
    isActive: (f) => f.priority === "HOT",
    apply: { priority: "HOT" },
    clear: { priority: undefined },
  },
  {
    id: "high",
    label: "Score 70+",
    hint: "High and hot leads",
    isActive: (f) => f.minScore === 70,
    apply: { minScore: 70 },
    clear: { minScore: undefined },
  },
  {
    id: "no-website",
    label: "No website",
    hint: "Businesses you can sell a site to",
    isActive: (f) => f.hasWebsite === false,
    apply: { hasWebsite: false },
    clear: { hasWebsite: undefined },
  },
  {
    id: "phone",
    label: "Has phone",
    hint: "Ready to call",
    isActive: (f) => f.hasPhone === true,
    apply: { hasPhone: true },
    clear: { hasPhone: undefined },
  },
];

const USER_FILTER_KEYS: (keyof LeadFilters)[] = [
  "q",
  "minScore",
  "maxScore",
  "priority",
  "city",
  "category",
  "hasWebsite",
  "hasPhone",
  "hasEmail",
  "opportunity",
];

export function countActiveFilters(filters: LeadFilters): number {
  return USER_FILTER_KEYS.filter((key) => {
    const v = filters[key];
    return v !== undefined && v !== "";
  }).length;
}

interface Props {
  filters: LeadFilters;
  onChange: (patch: Partial<LeadFilters>) => void;
}

export function QuickFilters({ filters, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Quick filters"
      className="flex flex-wrap items-center gap-1"
    >
      {PRESETS.map((preset) => {
        const active = preset.isActive(filters);
        return (
          <button
            key={preset.id}
            type="button"
            className="chip"
            aria-pressed={active}
            title={preset.hint}
            onClick={() => onChange(active ? preset.clear : preset.apply)}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
