export type ApiMetadata = {
  catalogue_id: string;
  data_as_of?: string;
  last_updated?: string;
  next_update?: string;
  update_frequency?: string;
  data_source?: string[];
  total?: number;
};

export type DatasetResponse<T> = {
  meta: ApiMetadata;
  data: T[];
  stale: boolean;
};

export type CpiRecord = {
  date: string;
  index: number;
  division: string;
};

export type StateCpiRecord = CpiRecord & {
  state: string;
};

export type FuelPriceRecord = {
  date: string;
  ron95: number | null;
  ron97: number | null;
  diesel: number | null;
  diesel_eastmsia: number | null;
  ron95_budi95: number | null;
  ron95_skps: number | null;
  diesel_budi?: number | null;
  diesel_skds?: number | null;
  series_type: string;
};

export type DatasetLoad<T> = {
  datasetId: string;
  data: T[];
  meta: ApiMetadata | null;
  stale: boolean;
  error?: string;
};

export type DashboardData = {
  cpi: DatasetLoad<CpiRecord>;
  stateCpi: DatasetLoad<StateCpiRecord>;
  fuelPrices: DatasetLoad<FuelPriceRecord>;
  months: number;
};

export type DatasetId = "cpi_headline" | "cpi_state" | "fuelprice";
