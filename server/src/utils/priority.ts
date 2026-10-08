import type { LeadPriority, PriorityLevel } from "../types/index.js";

export function getLeadPriority(score: number): LeadPriority {
  const clamped = Math.max(0, Math.min(100, score));

  let level: PriorityLevel;
  if (clamped >= 85) level = "HOT";
  else if (clamped >= 70) level = "HIGH";
  else if (clamped >= 50) level = "MEDIUM";
  else level = "LOW";

  const labels: Record<PriorityLevel, string> = {
    HOT: "Hot lead — contact immediately",
    HIGH: "High priority — strong opportunity",
    MEDIUM: "Medium priority — worth nurturing",
    LOW: "Low priority — lower urgency",
  };

  return { level, label: labels[level] };
}

export function priorityToScoreRange(priority: string): { min: number; max: number } | null {
  switch (priority.toUpperCase()) {
    case "HOT":
      return { min: 85, max: 100 };
    case "HIGH":
      return { min: 70, max: 84 };
    case "MEDIUM":
      return { min: 50, max: 69 };
    case "LOW":
      return { min: 0, max: 49 };
    default:
      return null;
  }
}
