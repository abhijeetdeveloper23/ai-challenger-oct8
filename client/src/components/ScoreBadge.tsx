import { getPriority, priorityStyles } from "../utils/priority";
import type { PriorityLevel } from "../types/lead";

interface Props {
  score: number;
  priority?: PriorityLevel;
  size?: "sm" | "lg";
}

export function ScoreBadge({ score, priority, size = "sm" }: Props) {
  const level = priority || getPriority(score);
  const styles = priorityStyles[level];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full ${styles.bg} ${styles.text} ${
        size === "lg" ? "px-4 py-2 text-base" : "px-2.5 py-1 text-sm"
      }`}
      aria-label={`Lead score ${score}, priority ${level}`}
    >
      <span className={`font-semibold tabular-nums ${size === "lg" ? "text-xl" : ""}`}>
        {score}
      </span>
      <span className="font-medium tracking-wide">
        {level}
        {level === "HOT" ? " 🔥" : ""}
      </span>
    </div>
  );
}
