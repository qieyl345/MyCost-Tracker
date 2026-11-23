import { describe, expect, it } from "vitest";
import { OpenDataError, parseDatasetResponse } from "./response-parser";
import type { FuelPriceRecord } from "./datasets";

const response = {
  meta: { catalogue_id: "fuelprice" },
  data: [
    {
      date: "2026-11-19",
      series_type: "level",
      ron95: 3.72,
      ron97: 4,
      diesel: 4.72,
      diesel_eastmsia: 4.72,
      ron95_budi95: 1.99,
      ron95_skps: 2.05,
      diesel_budi: 2.1,
      diesel_skds: 2.15,
    },
  ],
};

describe("parseDatasetResponse fuelprice", () => {
  it("accepts verified optional subsidy fields", () => {
    const parsed = parseDatasetResponse<FuelPriceRecord>(response, "fuelprice");

    expect(parsed.data[0].diesel_budi).toBe(2.1);
    expect(parsed.data[0].diesel_skds).toBe(2.15);
  });

  it("rejects malformed optional subsidy fields", () => {
    const malformed = {
      ...response,
      data: [{ ...response.data[0], diesel_budi: "2.1" }],
    };

    expect(() =>
      parseDatasetResponse<FuelPriceRecord>(malformed, "fuelprice"),
    ).toThrow(OpenDataError);
  });
});
