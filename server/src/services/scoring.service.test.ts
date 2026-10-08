import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreLead } from "./scoring.service.js";
import { deduplicateBusinesses } from "./deduplication.service.js";
import { getLeadPriority } from "../utils/priority.js";
import { normalizeBusinessName, normalizePhone, normalizeWebsite } from "../utils/normalize.js";

describe("scoring.service", () => {
  it("scores hot lead: no website + high reviews", () => {
    const result = scoreLead({
      name: "ABC Dental",
      phone: "+919876543210",
      rating: 4.7,
      reviewCount: 230,
    });

    assert.equal(result.scoreBreakdown.businessActivity, 30);
    assert.equal(result.scoreBreakdown.contactability, 10);
    assert.equal(result.scoreBreakdown.digitalOpportunity, 25);
    assert.equal(result.scoreBreakdown.conversionOpportunity, 20);
    assert.equal(result.leadScore, 85);
    assert.ok(result.opportunities.includes("No website"));
    assert.ok(result.primaryOpportunity.toLowerCase().includes("website"));
  });

  it("caps categories and clamps to 100", () => {
    const result = scoreLead(
      {
        name: "Test",
        phone: "123",
        email: "a@b.com",
        rating: 5,
        reviewCount: 500,
        website: "https://example.com",
      },
      {
        exists: true,
        reachable: false,
        https: true,
        hasBooking: false,
        hasContactForm: false,
      }
    );
    assert.ok(result.leadScore <= 100);
    assert.ok(result.leadScore >= 0);
  });
});

describe("deduplication.service", () => {
  it("dedupes by phone and website", () => {
    const unique = deduplicateBusinesses([
      { name: "ABC Dental Clinic", phone: "+91 98765 43210", source: "demo", sourceId: "1" },
      { name: "A.B.C Dental Clinic", phone: "09876543210", source: "demo", sourceId: "2" },
      {
        name: "Other",
        website: "https://www.smile.com/",
        source: "demo",
        sourceId: "3",
      },
      {
        name: "Other Dup",
        website: "http://smile.com",
        source: "demo",
        sourceId: "4",
      },
    ]);
    assert.equal(unique.length, 2);
  });
});

describe("priority + normalize", () => {
  it("maps score bands", () => {
    assert.equal(getLeadPriority(92).level, "HOT");
    assert.equal(getLeadPriority(75).level, "HIGH");
    assert.equal(getLeadPriority(55).level, "MEDIUM");
    assert.equal(getLeadPriority(20).level, "LOW");
  });

  it("normalizes identity fields", () => {
    assert.equal(normalizeBusinessName("A.B.C Dental Clinic"), "abc dental");
    assert.equal(normalizePhone("+91 98765 43210"), "9876543210");
    assert.equal(
      normalizeWebsite("http://www.Example.com/path/?utm_source=x"),
      "https://example.com/path"
    );
  });
});
