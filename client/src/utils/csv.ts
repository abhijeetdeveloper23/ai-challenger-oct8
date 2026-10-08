import type { Lead } from "../types/lead";

const HEADER = [
  "Name",
  "Category",
  "Phone",
  "Email",
  "Website",
  "City",
  "Rating",
  "Review Count",
  "Lead Score",
  "Priority",
  "Primary Opportunity",
  "Reasons",
];

/** Scraped data is untrusted: stop a leading = + - @ from becoming a formula. */
function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toRow(lead: Lead): string {
  return [
    escapeCell(safeCell(lead.name)),
    escapeCell(safeCell(lead.category || "")),
    // Phones legitimately start with "+", so they are not neutralised.
    escapeCell(lead.phone || ""),
    escapeCell(safeCell(lead.email || "")),
    escapeCell(safeCell(lead.website || "")),
    escapeCell(safeCell(lead.address?.city || "")),
    lead.rating ?? "",
    lead.reviewCount ?? 0,
    lead.leadScore,
    lead.priority || "",
    escapeCell(safeCell(lead.primaryOpportunity || "")),
    escapeCell(safeCell((lead.scoreReasons || []).join("; "))),
  ].join(",");
}

/** Download exactly the given leads as a CSV (BOM included so Excel reads UTF-8). */
export function downloadLeadsCsv(leads: Lead[], filename = "selected-leads.csv"): void {
  const csv = "\uFEFF" + [HEADER.join(","), ...leads.map(toRow)].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
