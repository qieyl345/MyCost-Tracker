import "server-only";

import type {
  CpiRecord,
  DatasetLoad,
  DatasetId,
  DatasetResponse,
  FuelPriceRecord,
  StateCpiRecord,
} from "@/lib/datasets";
import { OpenDataError, parseDatasetResponse } from "@/lib/response-parser";

const API_ORIGIN = "https://api.data.gov.my";
const CACHE_SECONDS = 60 * 60;
const REQUEST_WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 4;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 20_000;

type ApiFamily = "opendosm" | "data-catalogue";
type CacheEntry = {
  response: DatasetResponse<unknown>;
};

const responseCache = new Map<string, CacheEntry>();
const requestTimes = new Map<ApiFamily, number[]>();

export function getApiUrl(
  family: ApiFamily,
  datasetId: DatasetId,
  params: URLSearchParams,
) {
  const endpoint = family === "opendosm" ? "opendosm" : "data-catalogue";
  params.set("id", datasetId);
  params.set("meta", "true");
  return `${API_ORIGIN}/${endpoint}?${params.toString()}`;
}

export async function acquireRequestSlot(family: ApiFamily) {
  while (true) {
    const now = Date.now();
    const recent = (requestTimes.get(family) ?? []).filter(
      (time) => now - time < REQUEST_WINDOW_MS,
    );
    if (recent.length < REQUESTS_PER_WINDOW) {
      recent.push(now);
      requestTimes.set(family, recent);
      return;
    }

    requestTimes.set(family, recent);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(50, recent[0] + REQUEST_WINDOW_MS - now)),
    );
  }
}

export function retryDelay(response: Response | undefined, attempt: number) {
  const retryAfter = response?.headers.get("retry-after");
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 60_000);
  }
  if (response?.status === 429) {
    return 15_000;
  }
  return Math.min(1_000 * 2 ** attempt, 8_000);
}

export async function requestDataset<T>(
  family: ApiFamily,
  datasetId: DatasetId,
  params: URLSearchParams,
): Promise<DatasetResponse<T>> {
  const url = getApiUrl(family, datasetId, new URLSearchParams(params));
  const cached = responseCache.get(url);
  let lastError: OpenDataError | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    await acquireRequestSlot(family);
    let response: Response | undefined;

    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        next: { revalidate: CACHE_SECONDS },
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        lastError = new OpenDataError(
          `The ${datasetId} API returned HTTP ${response.status}.`,
          response.status,
        );
        if (!retryable || attempt === MAX_ATTEMPTS - 1) {
          break;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay(response, attempt)),
        );
        continue;
      }

      const payload = parseDatasetResponse<T>(
        await response.json(),
        datasetId,
      );
      responseCache.set(url, {
        response: payload as DatasetResponse<unknown>,
      });
      return payload;
    } catch (error) {
      lastError =
        error instanceof OpenDataError
          ? error
          : new OpenDataError(`Unable to reach the ${datasetId} API.`);
      if (attempt === MAX_ATTEMPTS - 1) {
        break;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay(response, attempt)),
      );
    }
  }

  if (cached) {
    return { ...cached.response, stale: true } as DatasetResponse<T>;
  }
  throw lastError ?? new OpenDataError(`Unable to load ${datasetId}.`);
}

export function startDate(months: number, now = new Date()) {
  const date = new Date(now);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months + 1);
  return date.toISOString().slice(0, 10);
}

export function datedRange(months: number, now = new Date()) {
  return `${startDate(months, now)}@date`;
}

export function normalizeMonths(value: string | null) {
  const months = Number(value);
  return months === 12 || months === 24 || months === 60 ? months : 24;
}

export async function fetchDashboardData(months: number) {
  const cpiPeriod = datedRange(months + 1);
  const period = datedRange(months);
  const cpiParams = new URLSearchParams({
    filter: "overall@division",
    date_start: cpiPeriod,
    sort: "date",
    limit: String(months + 1),
  });
  const stateParams = new URLSearchParams({
    filter: "overall@division",
    date_start: period,
    sort: "date",
    limit: String(months * 16),
  });
  const fuelParams = new URLSearchParams({
    filter: "level@series_type",
    date_start: period,
    sort: "date",
    limit: String(months * 5),
  });

  const [cpi, stateCpi, fuelPrices] = await Promise.allSettled([
    requestDataset<CpiRecord>("opendosm", "cpi_headline", cpiParams),
    requestDataset<StateCpiRecord>("opendosm", "cpi_state", stateParams),
    requestDataset<FuelPriceRecord>("data-catalogue", "fuelprice", fuelParams),
  ]);
  return {
    cpi: toDatasetLoad("cpi_headline", cpi),
    stateCpi: toDatasetLoad("cpi_state", stateCpi),
    fuelPrices: toDatasetLoad("fuelprice", fuelPrices),
  };
}

export function toDatasetLoad<T>(
  datasetId: DatasetId,
  result: PromiseSettledResult<DatasetResponse<T>>,
): DatasetLoad<T> {
  if (result.status === "fulfilled") {
    return {
      datasetId,
      data: result.value.data,
      meta: result.value.meta,
      stale: result.value.stale,
    };
  }

  const error = result.reason;
  return {
    datasetId,
    data: [],
    meta: null,
    stale: false,
    error:
      error instanceof OpenDataError && error.status === 429
        ? "The official API is rate-limiting requests. Please try again shortly."
        : `Could not load ${datasetId} data from the official API.`,
  };
}

export async function fetchExplorerData(
  datasetId: DatasetId,
  months: number,
  limit: number,
) {
  const params = new URLSearchParams({
    date_start: datedRange(months),
    sort: "-date",
    limit: String(Math.min(Math.max(limit, 1), 100)),
  });

  if (datasetId === "fuelprice") {
    params.set("filter", "level@series_type");
    params.set(
      "include",
      "date,ron95,ron97,diesel,diesel_eastmsia,series_type,ron95_budi95,ron95_skps,diesel_budi,diesel_skds",
    );
    return requestDataset<FuelPriceRecord>("data-catalogue", datasetId, params);
  }

  params.set("filter", "overall@division");
  if (datasetId === "cpi_headline") {
    params.set("include", "date,index,division");
    return requestDataset<CpiRecord>("opendosm", datasetId, params);
  }
  params.set("include", "date,state,index,division");
  return requestDataset<StateCpiRecord>("opendosm", datasetId, params);
}
