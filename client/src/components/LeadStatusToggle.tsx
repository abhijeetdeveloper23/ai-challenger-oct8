import { EyeOff, Star } from "lucide-react";
import { setLeadStatus, useLeadStatuses } from "../utils/storage";

/** Compact shortlist / skip toggles for a table row. State is saved in this browser. */
export function LeadStatusToggle({ id, name }: { id: string; name: string }) {
  const status = useLeadStatuses()[id];
  const shortlisted = status === "shortlisted";
  const skipped = status === "skipped";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-pressed={shortlisted}
        aria-label={shortlisted ? `Remove ${name} from shortlist` : `Shortlist ${name}`}
        title={shortlisted ? "Shortlisted" : "Shortlist"}
        onClick={() => setLeadStatus(id, shortlisted ? null : "shortlisted")}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
          shortlisted
            ? "bg-accent-soft text-accent"
            : "text-ink-muted hover:bg-border/60 hover:text-ink"
        }`}
      >
        <Star className={`h-4 w-4 ${shortlisted ? "fill-accent" : ""}`} aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={skipped}
        aria-label={skipped ? `Restore ${name}` : `Skip ${name}`}
        title={skipped ? "Skipped (click to restore)" : "Skip"}
        onClick={() => setLeadStatus(id, skipped ? null : "skipped")}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
          skipped
            ? "bg-border text-ink"
            : "text-ink-muted hover:bg-border/60 hover:text-ink"
        }`}
      >
        <EyeOff className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
