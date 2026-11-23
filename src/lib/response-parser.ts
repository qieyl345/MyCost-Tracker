import type {
  ApiMetadata,
  DatasetId,
  DatasetResponse,
} from "./datasets";

export class OpenDataError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "OpenDataError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableNumber(value: unknown) {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isValidDataRow(value: unknown, datasetId: DatasetId) {
  if (!isRecord(value) || typeof value.date !== "string") {
    return false;
  }
  if (datasetId === "fuelprice") {
    return (
      typeof value.series_type === "string" &&
      [
        value.ron95,
        value.ron97,
        value.diesel,
        value.diesel_eastmsia,
        value.ron95_budi95,
        value.ron95_skps,
      ].every(isNullableNumber)
      && [value.diesel_budi, value.diesel_skds].every(
        (field) => field === undefined || isNullableNumber(field),
      )
    );
  }
  if (
    typeof value.index !== "number" ||
    !Number.isFinite(value.index) ||
    typeof value.division !== "string"
  ) {
    return false;
  }
  return datasetId !== "cpi_state" || typeof value.state === "string";
}

export function parseDatasetResponse<T>(
  value: unknown,
  datasetId: DatasetId,
): DatasetResponse<T> {
  if (!isRecord(value) || !isRecord(value.meta) || !Array.isArray(value.data)) {
    throw new OpenDataError(`The ${datasetId} API returned an unexpected response.`);
  }

  const rawMeta = value.meta;
  if (rawMeta.catalogue_id !== datasetId) {
    throw new OpenDataError(`The ${datasetId} API response identified a different dataset.`);
  }
  if (!value.data.every((row) => isValidDataRow(row, datasetId))) {
    throw new OpenDataError(`The ${datasetId} API returned invalid dataset fields.`);
  }

  const meta: ApiMetadata = {
    catalogue_id: datasetId,
    data_as_of:
      typeof rawMeta.data_as_of === "string" ? rawMeta.data_as_of : undefined,
    last_updated:
      typeof rawMeta.last_updated === "string" ? rawMeta.last_updated : undefined,
    next_update:
      typeof rawMeta.next_update === "string" ? rawMeta.next_update : undefined,
    update_frequency:
      typeof rawMeta.update_frequency === "string"
        ? rawMeta.update_frequency
        : undefined,
    data_source: Array.isArray(rawMeta.data_source)
      ? rawMeta.data_source.filter(
          (source): source is string => typeof source === "string",
        )
      : undefined,
    total: typeof rawMeta.total === "number" ? rawMeta.total : undefined,
  };

  return {
    meta,
    data: value.data as T[],
    stale: false,
  };
}
