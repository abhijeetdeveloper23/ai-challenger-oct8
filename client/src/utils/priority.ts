import type { PriorityLevel } from "../types/lead";

export function getPriority(score: number): PriorityLevel {
  if (score >= 85) return "HOT";
  if (score >= 70) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

export const priorityStyles: Record<
  PriorityLevel,
  { bg: string; text: string; label: string }
> = {
  HOT: { bg: "bg-hot-bg", text: "text-hot", label: "HOT" },
  HIGH: { bg: "bg-high-bg", text: "text-high", label: "HIGH" },
  MEDIUM: { bg: "bg-medium-bg", text: "text-medium", label: "MEDIUM" },
  LOW: { bg: "bg-low-bg", text: "text-low", label: "LOW" },
};
