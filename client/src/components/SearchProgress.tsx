import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

const STEPS = [
  "Finding businesses",
  "Checking their websites",
  "Scoring and ranking leads",
];

/**
 * The search is a single request, so the server can't report real progress.
 * These phases mirror what it does in order and advance on a timer, so the
 * wait feels explained instead of frozen. The last phase stays active until
 * the response arrives.
 */
export function SearchProgress({
  industry,
  location,
  product,
}: {
  industry: string;
  location: string;
  product?: string;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => Math.min(current + 1, STEPS.length - 1));
    }, 3500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-5 rounded-lg border border-border bg-warm-soft/60 px-4 py-3"
    >
      <p className="text-sm font-semibold text-ink">
        Searching {industry} in {location}
        {product?.trim() ? ` for “${product.trim()}”` : ""}…
      </p>
      <ol className="mt-2 space-y-1.5">
        {STEPS.map((step, index) => {
          const done = index < active;
          const current = index === active;
          return (
            <li
              key={step}
              className={`flex items-center gap-2 text-sm ${
                done || current ? "text-ink" : "text-ink-muted"
              }`}
            >
              {done ? (
                <Check className="h-4 w-4 text-success" aria-hidden />
              ) : current ? (
                <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
              ) : (
                <span className="h-4 w-4 rounded-full border border-border" aria-hidden />
              )}
              {step}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
