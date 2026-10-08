/** Animated enrichment progress — used while owner / company lookup runs. */
export function EnrichPulse({
  label,
  count,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="enrich-pulse relative overflow-hidden px-5 py-10"
    >
      <div className="enrich-pulse__glow" aria-hidden />
      <div className="relative mx-auto flex max-w-md flex-col items-center text-center">
        <div className="enrich-pulse__orb" aria-hidden>
          <span className="enrich-pulse__ring" />
          <span className="enrich-pulse__ring enrich-pulse__ring--delay" />
          <span className="enrich-pulse__core" />
        </div>
        <p className="mt-5 text-sm font-semibold text-ink">{label}</p>
        {count != null && count > 0 && (
          <p className="mt-1 text-xs text-ink-muted">
            Checking {count} compan{count === 1 ? "y" : "ies"}…
          </p>
        )}
        <div className="mt-5 flex w-full max-w-xs gap-1.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="enrich-pulse__bar h-1 flex-1 rounded-full bg-accent/20"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
