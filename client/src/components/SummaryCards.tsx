import type { LeadSummary } from "../types/lead";

interface Props {
  summary?: LeadSummary | null;
  loading?: boolean;
}

export function SummaryCards({ summary, loading }: Props) {
  const cards = [
    { label: "Total", value: summary?.total ?? 0 },
    { label: "Hot", value: summary?.hot ?? 0 },
    { label: "High", value: summary?.high ?? 0 },
    { label: "Opportunities", value: summary?.opportunities ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-surface-elevated px-4 py-3 shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            {card.label}
          </p>
          {loading ? (
            <div className="mt-2 h-7 w-12 animate-pulse rounded bg-border" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
              {card.value}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
