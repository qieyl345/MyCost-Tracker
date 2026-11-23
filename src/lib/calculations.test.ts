import { describe, expect, it } from "vitest";
import {
  calculateBudgetTotal,
  calculateInflationAdjustedTotal,
  calculateYearOverYearChange,
  formatMyR,
  STARTER_BUDGET,
} from "./calculations";
import { OpenDataError, parseDatasetResponse } from "./response-parser";

describe("official data parsing", () => {
  it("accepts a source response with the verified CPI fields and metadata", () => {
    const parsed = parseDatasetResponse<{ date: string; index: number; division: string }>(
      {
        meta: {
          catalogue_id: "cpi_headline",
          data_as_of: "2026-10",
          last_updated: "2026-11-19 13:09",
          total: 1,
        },
        data: [{ date: "2026-10-01", index: 137.7, division: "overall" }],
      },
      "cpi_headline",
    );

    expect(parsed.data[0]?.index).toBe(137.7);
    expect(parsed.meta.data_as_of).toBe("2026-10");
    expect(parsed.stale).toBe(false);
  });

  it("rejects a response with an unexpected dataset ID or unverified row fields", () => {
    expect(() =>
      parseDatasetResponse(
        {
          meta: { catalogue_id: "fuelprice" },
          data: [{ date: "2026-10-01", index: 137.7, division: "overall" }],
        },
        "cpi_headline",
      ),
    ).toThrow(OpenDataError);

    expect(() =>
      parseDatasetResponse(
        {
          meta: { catalogue_id: "cpi_headline" },
          data: [{ date: "2026-10-01", index: "137.7", division: "overall" }],
        },
        "cpi_headline",
      ),
    ).toThrow("invalid dataset fields");
  });
});

describe("budget and CPI calculations", () => {
  it("calculates a year-over-year CPI change only when the matching month exists", () => {
    expect(
      calculateYearOverYearChange([
        { date: "2025-10-01", index: 130, division: "overall" },
        { date: "2026-10-01", index: 137.7, division: "overall" },
      ]),
    ).toBeCloseTo((137.7 / 130 - 1) * 100, 8);

    expect(
      calculateYearOverYearChange([
        { date: "2026-10-01", index: 137.7, division: "overall" },
      ]),
    ).toBeNull();

    expect(
      calculateYearOverYearChange([
        { date: "2026-10-01", index: 137.7, division: "overall" },
        { date: "2025-10-01", index: 0, division: "overall" },
      ]),
    ).toBeNull();

    expect(
      calculateYearOverYearChange([
        { date: "2026-10-01", index: 137.7, division: "overall" },
        { date: "2025-10-01", index: 135.1, division: "overall" },
      ]),
    ).toBeCloseTo((137.7 / 135.1 - 1) * 100, 8);
  });

  it("totals editable budget lines and applies the disclosed CPI assumption", () => {
    expect(calculateBudgetTotal(STARTER_BUDGET)).toBe(2400);

    const monthlyTotal = calculateBudgetTotal([
      { id: "rent", label: "Housing", amount: 1200 },
      { id: "food", label: "Food", amount: 650 },
    ]);

    expect(monthlyTotal).toBe(1850);
    expect(calculateInflationAdjustedTotal(monthlyTotal, 2.5)).toBeCloseTo(1896.25);
    expect(formatMyR(1234.5)).toContain("1,234.50");
    expect(formatMyR(1234.5)).toContain("RM");
  });
});
