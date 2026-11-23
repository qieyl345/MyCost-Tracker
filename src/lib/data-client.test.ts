import { afterEach, describe, expect, it, vi } from "vitest";
import type { DatasetId } from "./datasets";

vi.mock("server-only", () => ({}));

async function loadClient() {
  vi.resetModules();
  return import("./data-client");
}

function responseFor(datasetId: DatasetId, status = 200) {
  if (status !== 200) {
    return new Response(null, { status });
  }

  const rows = {
    cpi_headline: [{ date: "2026-10-01", index: 137.7, division: "overall" }],
    cpi_state: [
      {
        date: "2026-10-01",
        index: 144.7,
        division: "overall",
        state: "Selangor",
      },
    ],
    fuelprice: [
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
  } satisfies Record<DatasetId, unknown[]>;

  return new Response(
    JSON.stringify({
      meta: { catalogue_id: datasetId, data_as_of: "2026-10" },
      data: rows[datasetId],
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

function stubFetch(
  implementation: (input: unknown) => Promise<Response>,
) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("data client helpers", () => {
  it("normalizes month choices and builds deterministic date ranges and URLs", async () => {
    const client = await loadClient();
    const now = new Date("2026-11-24T12:00:00.000Z");

    expect(client.normalizeMonths("12")).toBe(12);
    expect(client.normalizeMonths("60")).toBe(60);
    expect(client.normalizeMonths("13")).toBe(24);
    expect(client.normalizeMonths(null)).toBe(24);
    expect(client.startDate(12, now)).toBe("2025-12-01");
    expect(client.datedRange(60, now)).toBe("2021-12-01@date");

    const params = new URLSearchParams({ filter: "overall@division" });
    const url = new URL(
      client.getApiUrl("opendosm", "cpi_headline", params),
    );
    expect(url.origin).toBe("https://api.data.gov.my");
    expect(url.pathname).toBe("/opendosm");
    expect(url.searchParams.get("id")).toBe("cpi_headline");
    expect(url.searchParams.get("meta")).toBe("true");
    expect(url.searchParams.get("filter")).toBe("overall@division");
  });

  it("uses bounded retry delays and honors Retry-After", async () => {
    const client = await loadClient();

    expect(
      client.retryDelay(new Response(null, {
        status: 429,
        headers: { "retry-after": "2" },
      }), 0),
    ).toBe(2000);
    expect(client.retryDelay(new Response(null, { status: 429 }), 0)).toBe(
      15_000,
    );
    expect(client.retryDelay(new Response(null, { status: 503 }), 2)).toBe(
      4000,
    );
    expect(client.retryDelay(undefined, 8)).toBe(8000);
  });

  it("retries transient failures then returns the last successful response as stale", async () => {
    vi.useFakeTimers();
    const client = await loadClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseFor("cpi_headline"))
      .mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const params = new URLSearchParams({ sort: "date" });

    const fresh = await client.requestDataset("opendosm", "cpi_headline", params);
    expect(fresh.stale).toBe(false);

    const stalePromise = client.requestDataset(
      "opendosm",
      "cpi_headline",
      params,
    );
    await vi.advanceTimersByTimeAsync(3000);
    const stale = await stalePromise;

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(stale.stale).toBe(true);
    expect(stale.data).toEqual(fresh.data);
  });

  it("limits each API family independently and releases a slot after the window", async () => {
    vi.useFakeTimers();
    const client = await loadClient();

    for (let index = 0; index < 4; index += 1) {
      await client.acquireRequestSlot("data-catalogue");
    }

    let released = false;
    const waiting = client.acquireRequestSlot("data-catalogue").then(() => {
      released = true;
    });
    await Promise.resolve();
    expect(released).toBe(false);

    await client.acquireRequestSlot("opendosm");
    await vi.advanceTimersByTimeAsync(60_000);
    await waiting;
    expect(released).toBe(true);
  });

  it("loads dashboard datasets and preserves a clear error for a failed source", async () => {
    const client = await loadClient();
    const fetchMock = stubFetch(async (input) => {
      const datasetId = new URL(String(input)).searchParams.get(
        "id",
      ) as DatasetId;
      return datasetId === "cpi_headline"
        ? responseFor(datasetId, 404)
        : responseFor(datasetId);
    });

    const result = await client.fetchDashboardData(12);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.cpi.data).toEqual([]);
    expect(result.cpi.error).toContain("Could not load cpi_headline");
    expect(result.stateCpi.data[0]?.state).toBe("Selangor");
    expect(result.fuelPrices.data[0]?.ron95).toBe(3.72);
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls.find((url) => url.searchParams.get("id") === "cpi_headline")
      ?.searchParams.get("filter")).toBe("overall@division");
    expect(urls.find((url) => url.searchParams.get("id") === "fuelprice")
      ?.searchParams.get("filter")).toBe("level@series_type");
  });

  it("builds explorer queries for CPI and includes all verified fuel fields", async () => {
    const client = await loadClient();
    const fetchMock = stubFetch(async (input) => {
      const datasetId = new URL(String(input)).searchParams.get(
        "id",
      ) as DatasetId;
      return responseFor(datasetId);
    });

    await client.fetchExplorerData("cpi_headline", 12, 10);
    await client.fetchExplorerData("cpi_state", 24, 20);
    await client.fetchExplorerData("fuelprice", 60, 500);

    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls[0]?.pathname).toBe("/opendosm");
    expect(urls[0]?.searchParams.get("include")).toBe("date,index,division");
    expect(urls[1]?.searchParams.get("include")).toBe(
      "date,state,index,division",
    );
    const fuelUrl = urls[2];
    expect(fuelUrl?.pathname).toBe("/data-catalogue");
    expect(fuelUrl?.searchParams.get("limit")).toBe("100");
    expect(fuelUrl?.searchParams.get("filter")).toBe("level@series_type");
    expect(fuelUrl?.searchParams.get("include")).toContain("diesel_budi");
    expect(fuelUrl?.searchParams.get("include")).toContain("diesel_skds");
  });

  it("maps rate-limit failures to an actionable dashboard error", async () => {
    const client = await loadClient();
    const { OpenDataError } = await import("./response-parser");
    const result = client.toDatasetLoad("fuelprice", {
      status: "rejected",
      reason: new OpenDataError("rate limited", 429),
    });

    expect(result.data).toEqual([]);
    expect(result.error).toContain("rate-limiting requests");
    expect(result.stale).toBe(false);
  });
});
