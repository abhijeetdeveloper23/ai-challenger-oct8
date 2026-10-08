import type { ScoreBreakdown as Breakdown } from "../types/lead";

interface Props {
  breakdown: Breakdown;
}

const rows: { key: keyof Breakdown; label: string; max: number }[] = [
  { key: "businessActivity", label: "Business Activity", max: 30 },
  { key: "contactability", label: "Contactability", max: 20 },
  { key: "digitalOpportunity", label: "Digital Opportunity", max: 30 },
  { key: "conversionOpportunity", label: "Conversion Opportunity", max: 20 },
];

export function ScoreBreakdownBars({ breakdown }: Props) {
  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const value = breakdown[row.key] ?? 0;
        const pct = Math.round((value / row.max) * 100);
        return (
          <div key={row.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-ink">{row.label}</span>
              <span className="text-sm tabular-nums text-ink-muted">
                {value}/{row.max}
              </span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-border/70"
              role="progressbar"
              aria-valuenow={value}
              aria-valuemin={0}
              aria-valuemax={row.max}
              aria-label={row.label}
            >
              <div
                className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
