export function LeadCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-surface-elevated p-5">
      <div className="flex justify-between">
        <div className="h-6 w-40 rounded bg-border/70" />
        <div className="h-7 w-20 rounded-full bg-border/70" />
      </div>
      <div className="mt-4 h-4 w-48 rounded bg-border/50" />
      <div className="mt-2 h-4 w-32 rounded bg-border/50" />
      <div className="mt-4 h-10 w-full rounded-xl bg-border/40" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-3/4 rounded bg-border/40" />
        <div className="h-3 w-2/3 rounded bg-border/40" />
      </div>
      <div className="mt-5 h-10 w-28 rounded-xl bg-border/60" />
    </div>
  );
}
