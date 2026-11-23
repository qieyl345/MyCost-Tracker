"use client";

import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleHelp,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { BudgetLine } from "@/lib/calculations";
import {
  calculateBudgetTotal,
  calculateInflationAdjustedTotal,
  calculateYearOverYearChange,
  formatMyR,
  STARTER_BUDGET,
} from "@/lib/calculations";
import type {
  ApiMetadata,
  CpiRecord,
  DashboardData,
  DatasetId,
  DatasetLoad,
  FuelPriceRecord,
  StateCpiRecord,
} from "@/lib/datasets";
import {
  CpiTrendChart,
  FuelPriceChart,
  StateCpiChart,
} from "./data-charts";

const DATASET_OPTIONS: { id: DatasetId; label: string }[] = [
  { id: "cpi_headline", label: "Monthly CPI by division" },
  { id: "cpi_state", label: "Monthly CPI by state" },
  { id: "fuelprice", label: "Weekly fuel prices" },
];

const SOURCES = {
  cpi: "https://open.dosm.gov.my/data-catalogue/cpi_headline",
  stateCpi: "https://open.dosm.gov.my/data-catalogue/cpi_state",
  fuel: "https://data.gov.my/data-catalogue/fuelprice",
};
const BUDGET_STORAGE_KEY = "mycost-budget-v1";
const BUDGET_CHANGE_EVENT = "mycost-budget-change";
const STORAGE_UNAVAILABLE = "__storage-unavailable__";
const EMPTY_CPI: CpiRecord[] = [];
const EMPTY_STATES: StateCpiRecord[] = [];
const EMPTY_FUEL: FuelPriceRecord[] = [];

function subscribeToBudget(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(BUDGET_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(BUDGET_CHANGE_EVENT, callback);
  };
}

function getBudgetSnapshot() {
  try {
    return window.localStorage.getItem(BUDGET_STORAGE_KEY) ?? "";
  } catch {
    return STORAGE_UNAVAILABLE;
  }
}

function getServerBudgetSnapshot() {
  return "";
}

function parseSavedBudget(value: string) {
  if (!value) return { lines: STARTER_BUDGET, message: "" };
  if (value === STORAGE_UNAVAILABLE) {
    return {
      lines: STARTER_BUDGET,
      message: "Browser storage is unavailable; budget edits may not persist.",
    };
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every(isBudgetLine)) {
      return { lines: parsed, message: "" };
    }
    return {
      lines: STARTER_BUDGET,
      message: "Saved budget entries were invalid; the sample scenario is shown.",
    };
  } catch {
    return {
      lines: STARTER_BUDGET,
      message: "Saved budget entries could not be read; the sample scenario is shown.",
    };
  }
}

type ExplorerPayload = {
  datasetId: DatasetId;
  data: Record<string, unknown>[];
  meta: ApiMetadata;
  stale: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDatasetLoad(value: unknown): value is DatasetLoad<unknown> {
  return (
    isRecord(value) &&
    typeof value.datasetId === "string" &&
    Array.isArray(value.data) &&
    typeof value.stale === "boolean" &&
    (value.meta === null || isRecord(value.meta))
  );
}

function isDashboardPayload(value: unknown): value is DashboardData {
  return (
    isRecord(value) &&
    isDatasetLoad(value.cpi) &&
    isDatasetLoad(value.stateCpi) &&
    isDatasetLoad(value.fuelPrices) &&
    typeof value.months === "number"
  );
}

function isExplorerPayload(value: unknown): value is ExplorerPayload {
  return (
    isRecord(value) &&
    (value.datasetId === "cpi_headline" ||
      value.datasetId === "cpi_state" ||
      value.datasetId === "fuelprice") &&
    Array.isArray(value.data) &&
    value.data.every(isRecord) &&
    isRecord(value.meta) &&
    typeof value.stale === "boolean"
  );
}

function displayDate(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en-MY", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  }
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-MY", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}

function dateThreshold(months: number, latestDate?: string) {
  if (!latestDate) return "0000-01-01";
  const date = new Date(`${latestDate.slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months + 1);
  return date.toISOString().slice(0, 10);
}

function latestByDate<T extends { date: string }>(records: T[]) {
  return [...records].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
}

function isBudgetLine(value: unknown): value is BudgetLine {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.amount === "number" &&
    Number.isFinite(value.amount) &&
    value.amount >= 0
  );
}

function latestStateRecords(records: StateCpiRecord[]) {
  const latestDate = latestByDate(records)?.date;
  return latestDate
    ? records.filter((record) => record.date === latestDate)
    : [];
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The data request failed.";
}

function sourceSummary(dataset: DatasetLoad<unknown> | undefined) {
  if (!dataset?.meta) return null;
  const freshness = dataset.stale ? "Showing the last successful response." : null;
  return {
    date: dataset.meta.data_as_of ?? dataset.meta.last_updated ?? "",
    update: dataset.meta.update_frequency?.toLowerCase() ?? "",
    freshness,
  };
}

function dateRangeLabel(records: { date: string }[]) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0]?.date;
  const last = sorted.at(-1)?.date;
  return first && last
    ? `${displayDate(first)} – ${displayDate(last)}`
    : "Waiting for source data";
}

function ChartStatus({
  loading,
  error,
  empty,
}: {
  loading: boolean;
  error?: string;
  empty: boolean;
}) {
  if (loading) {
    return (
      <div className="chart-placeholder" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading official data…
      </div>
    );
  }
  if (error || empty) {
    return (
      <div className="chart-placeholder error-placeholder" role="status">
        <CircleHelp size={20} aria-hidden="true" />
        <span>{error ?? "No observations are available for this range."}</span>
      </div>
    );
  }
  return null;
}

export default function Dashboard() {
  const [months, setMonths] = useState(24);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [selectedState, setSelectedState] = useState("Selangor");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [budgetMessage, setBudgetMessage] = useState("");
  const [explorerDataset, setExplorerDataset] = useState<DatasetId>("fuelprice");
  const [explorer, setExplorer] = useState<ExplorerPayload | null>(null);
  const [explorerSearch, setExplorerSearch] = useState("");
  const [explorerError, setExplorerError] = useState<string | null>(null);
  const [loadingExplorer, setLoadingExplorer] = useState(true);
  const savedBudget = useSyncExternalStore(
    subscribeToBudget,
    getBudgetSnapshot,
    getServerBudgetSnapshot,
  );
  const parsedBudget = useMemo(() => parseSavedBudget(savedBudget), [savedBudget]);
  const budget = parsedBudget.lines;
  const shownBudgetMessage = budgetMessage || parsedBudget.message;

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard?months=60")
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (response.status !== 503 && !response.ok) {
          throw new Error("The dashboard data service is temporarily unavailable.");
        }
        if (!isDashboardPayload(payload)) {
          throw new Error("The dashboard data service returned an invalid response.");
        }
        if (active) setDashboard(payload);
      })
      .catch((error: unknown) => {
        if (active) setDashboardError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoadingDashboard(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function updateBudget(
    update: BudgetLine[] | ((current: BudgetLine[]) => BudgetLine[]),
  ) {
    const nextBudget = typeof update === "function" ? update(budget) : update;
    try {
      window.localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(nextBudget));
      setBudgetMessage("");
      window.dispatchEvent(new Event(BUDGET_CHANGE_EVENT));
    } catch {
      setBudgetMessage("Budget edits are not being saved in this browser.");
    }
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/explorer?dataset=${explorerDataset}&months=60&limit=100`)
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            isRecord(payload) && typeof payload.error === "string"
              ? payload.error
              : "The selected dataset could not be loaded.",
          );
        }
        if (!isExplorerPayload(payload)) {
          throw new Error("The selected dataset returned an invalid response.");
        }
        if (active) setExplorer(payload);
      })
      .catch((error: unknown) => {
        if (active) setExplorerError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoadingExplorer(false);
      });

    return () => {
      active = false;
    };
  }, [explorerDataset]);

  const cpiRows = dashboard?.cpi.data ?? EMPTY_CPI;
  const latestCpi = latestByDate(cpiRows);
  const visibleCpiRows = useMemo(() => {
    const threshold = dateThreshold(months, latestCpi?.date);
    return cpiRows.filter((record) => record.date >= threshold);
  }, [cpiRows, latestCpi?.date, months]);
  const yearOverYear = calculateYearOverYearChange(cpiRows);
  const states = latestStateRecords(dashboard?.stateCpi.data ?? EMPTY_STATES);
  const stateNames = states.map((record) => record.state).sort((a, b) => a.localeCompare(b));
  const selectedStateExists = stateNames.includes(selectedState);
  const allFuelRows = dashboard?.fuelPrices.data ?? EMPTY_FUEL;
  const latestFuel = latestByDate(allFuelRows);
  const fuelRows = useMemo(() => {
    const threshold = dateThreshold(months, latestFuel?.date);
    return allFuelRows.filter((record) => record.date >= threshold);
  }, [allFuelRows, latestFuel?.date, months]);
  const monthlyBudget = calculateBudgetTotal(budget);
  const projectedBudget =
    yearOverYear === null
      ? null
      : calculateInflationAdjustedTotal(monthlyBudget, yearOverYear);
  const cpiSummary = sourceSummary(dashboard?.cpi);
  const stateSummary = sourceSummary(dashboard?.stateCpi);
  const fuelSummary = sourceSummary(dashboard?.fuelPrices);
  const explorerOptions = DATASET_OPTIONS;
  const explorerRows = useMemo(() => {
    const query = explorerSearch.trim().toLowerCase();
    const rows = explorer?.data ?? [];
    return query
      ? rows.filter((row) =>
          Object.values(row).some((value) =>
            String(value ?? "").toLowerCase().includes(query),
          ),
        )
      : rows;
  }, [explorer, explorerSearch]);
  const explorerColumns = explorerRows[0] ? Object.keys(explorerRows[0]) : [];

  function updateBudgetLine(id: string, field: "label" | "amount", value: string) {
    updateBudget((current) =>
      current.map((line) =>
        line.id !== id
          ? line
          : {
              ...line,
              [field]:
                field === "amount"
                  ? Math.min(1_000_000, Math.max(0, Number(value) || 0))
                  : value,
            },
      ),
    );
  }

  function addBudgetLine() {
    updateBudget((current) => [
      ...current,
      { id: `category-${Date.now()}`, label: "New category", amount: 0 },
    ]);
  }

  function exportExplorerCsv() {
    if (explorerColumns.length === 0) return;
    const escape = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      explorerColumns.map(escape).join(","),
      ...explorerRows.map((row) =>
        explorerColumns.map((column) => escape(row[column])).join(","),
      ),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${explorerDataset}-data.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href="#" aria-label="MyCost Tracker home">
          <span className="brand-mark">
            <Wallet size={19} aria-hidden="true" />
          </span>
          <span>mycost<span className="brand-light">.tracker</span></span>
        </a>
        <nav className="top-navigation" aria-label="Main navigation">
          <a className="nav-active" href="#overview">Overview</a>
          <a href="#budget">My budget</a>
          <a href="#explorer">Data explorer</a>
        </nav>
        <div className="topbar-actions">
          <span className="live-status"><span aria-hidden="true" /> Official data</span>
          <button
            className="icon-button theme-button"
            type="button"
            onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      <main id="main-content" className="main-content">
        <section id="overview" className="welcome-row">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> MALAYSIA COST SNAPSHOT</div>
            <h1>Make sense of your <span>monthly costs.</span></h1>
            <p className="welcome-copy">
              Explore official price trends, then shape a budget around your own numbers.
            </p>
            {dashboardError && (
              <p className="notice notice-error" role="alert">{dashboardError}</p>
            )}
            {shownBudgetMessage && (
              <p className="notice notice-warn" role="status">{shownBudgetMessage}</p>
            )}
          </div>
          <div className="period-control">
            <label htmlFor="period-select">Chart period</label>
            <div className="select-wrap">
              <select
                id="period-select"
                value={months}
                onChange={(event) => setMonths(Number(event.target.value))}
              >
                <option value={12}>Last 12 months</option>
                <option value={24}>Last 24 months</option>
                <option value={60}>Last 5 years</option>
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="metric-grid" aria-label="Current indicators">
          <article className="metric-card metric-primary">
            <div className="metric-top">
              <span className="metric-label">Malaysia CPI</span>
              <span className="metric-icon"><BarChart3 size={18} /></span>
            </div>
            <strong>{latestCpi ? latestCpi.index.toFixed(1) : "—"}</strong>
            <div className="metric-bottom">
              <span>Index · 2010 = 100</span>
              {latestCpi && <span className="metric-date">{displayDate(latestCpi.date)}</span>}
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-top">
              <span className="metric-label">CPI change year-on-year</span>
              <span className="metric-icon green"><ArrowUpRight size={18} /></span>
            </div>
            <strong>{yearOverYear === null ? "—" : `${yearOverYear.toFixed(1)}%`}</strong>
            <div className="metric-bottom">
              <span>Calculated from index values</span>
              {cpiSummary && <span className="metric-date">As of {displayDate(cpiSummary.date)}</span>}
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-top">
              <span className="metric-label">RON95 · general market</span>
              <span className="metric-icon orange"><RefreshCw size={17} /></span>
            </div>
            <strong>{latestFuel?.ron95 == null ? "—" : formatMyR(latestFuel.ron95)}</strong>
            <div className="metric-bottom">
              <span>RM per litre · weekly series</span>
              {latestFuel && <span className="metric-date">{displayDate(latestFuel.date)}</span>}
            </div>
          </article>
          <article className="metric-card budget-metric">
            <div className="metric-top">
              <span className="metric-label">Sample monthly budget</span>
              <span className="metric-icon purple"><Wallet size={18} /></span>
            </div>
            <strong>{formatMyR(monthlyBudget)}</strong>
            <div className="metric-bottom">
              <span>Illustrative inputs · editable below</span>
              <a href="#budget">Edit <ArrowUpRight size={13} /></a>
            </div>
          </article>
        </section>

        <section className="chart-grid" aria-label="Official price and CPI charts">
          <article className="panel chart-panel cpi-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-kicker">PRICE TRENDS</div>
                <h2>Consumer price index</h2>
                <p>Malaysia · overall basket · {dateRangeLabel(visibleCpiRows)}</p>
              </div>
              <a
                className="source-link"
                href={SOURCES.cpi}
                target="_blank"
                rel="noreferrer"
                aria-label="Open the official monthly CPI dataset"
              >
                DOSM source <ArrowUpRight size={14} />
              </a>
            </div>
            <div className="chart-wrap">
              <ChartStatus
                loading={loadingDashboard}
                error={dashboard?.cpi.error}
                empty={visibleCpiRows.length === 0}
              />
              {!loadingDashboard && visibleCpiRows.length > 0 && (
                <CpiTrendChart records={visibleCpiRows} />
              )}
            </div>
            <div className="panel-footnote">
              <span>Index base: 2010 = 100</span>
              {cpiSummary && (
                <span>
                  {cpiSummary.freshness ?? `DOSM updates ${cpiSummary.update}`}
                </span>
              )}
            </div>
          </article>

          <article className="panel chart-panel state-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-kicker">REGIONAL COMPARISON</div>
                <h2>CPI by state</h2>
                <p>Overall index · {states[0] ? displayDate(states[0].date) : "latest available month"}</p>
              </div>
              <label className="compact-select" htmlFor="state-select">
                <span className="sr-only">Highlight a state in the chart</span>
                <select
                  id="state-select"
                  value={selectedStateExists ? selectedState : stateNames[0] ?? ""}
                  onChange={(event) => setSelectedState(event.target.value)}
                  disabled={stateNames.length === 0}
                >
                  {stateNames.map((state) => <option key={state}>{state}</option>)}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </label>
            </div>
            <div className="chart-wrap">
              <ChartStatus
                loading={loadingDashboard}
                error={dashboard?.stateCpi.error}
                empty={states.length === 0}
              />
              {!loadingDashboard && states.length > 0 && (
                <StateCpiChart records={states} selectedState={selectedState} />
              )}
            </div>
            <div className="panel-footnote">
              <span>{states.length} state/territory observations</span>
              {stateSummary && (
                <span>
                  {stateSummary.freshness ?? `DOSM updates ${stateSummary.update}`}
                </span>
              )}
              <a href={SOURCES.stateCpi} target="_blank" rel="noreferrer">
                Source <ArrowUpRight size={13} />
              </a>
            </div>
          </article>

          <article className="panel chart-panel fuel-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-kicker">WEEKLY RETAIL PRICES</div>
                <h2>Fuel price watch</h2>
                <p>RM per litre · {dateRangeLabel(fuelRows)}</p>
              </div>
              <a
                className="source-link"
                href={SOURCES.fuel}
                target="_blank"
                rel="noreferrer"
                aria-label="Open the official weekly fuel-price dataset"
              >
                MOF source <ArrowUpRight size={14} />
              </a>
            </div>
            <div className="chart-wrap">
              <ChartStatus
                loading={loadingDashboard}
                error={dashboard?.fuelPrices.error}
                empty={fuelRows.length === 0}
              />
              {!loadingDashboard && fuelRows.length > 0 && (
                <FuelPriceChart records={fuelRows} />
              )}
            </div>
            <div className="panel-footnote">
              <span>RON95 general market · RON97 · diesel (Peninsular)</span>
              {fuelSummary && (
                <span>
                  {fuelSummary.freshness ?? `MOF updates ${fuelSummary.update}`}
                </span>
              )}
            </div>
            <p className="caveat-inline">
              Subsidised and East Malaysia prices differ; see the explorer for reported variants.
            </p>
          </article>
        </section>

        <section id="budget" className="budget-section">
          <div className="section-title-row">
            <div>
              <div className="panel-kicker">YOUR PLAN, YOUR ASSUMPTIONS</div>
              <h2>Monthly budget planner</h2>
              <p>Replace the sample entries with your own monthly estimates.</p>
            </div>
            <span className="local-save"><Check size={14} /> Saved in this browser</span>
          </div>
          <div className="budget-grid">
            <div className="panel budget-editor">
              <div className="budget-editor-heading">
                <div>
                  <h3>Example expense inputs</h3>
                  <p>Illustrative one-household scenario · amounts in MYR</p>
                </div>
                <button className="add-button" type="button" onClick={addBudgetLine}>
                  <Plus size={16} /> Add category
                </button>
              </div>
              <div className="budget-lines">
                {budget.map((line) => (
                  <div className="budget-line" key={line.id}>
                    <label className="budget-name">
                      <span className="sr-only">Expense category</span>
                      <input
                        type="text"
                        value={line.label}
                        maxLength={40}
                        onChange={(event) =>
                          updateBudgetLine(line.id, "label", event.target.value)
                        }
                      />
                    </label>
                    <label className="budget-amount">
                      <span className="sr-only">Monthly amount in ringgit</span>
                      <span>RM</span>
                      <input
                        type="number"
                        min="0"
                        max="1000000"
                        step="10"
                        value={line.amount}
                        onChange={(event) =>
                          updateBudgetLine(line.id, "amount", event.target.value)
                        }
                      />
                    </label>
                    <button
                      className="remove-button"
                      type="button"
                      onClick={() => updateBudget((current) => current.filter((entry) => entry.id !== line.id))}
                      aria-label={`Remove ${line.label || "unnamed"} category`}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="budget-total">
                <span>Estimated monthly total</span>
                <strong>{formatMyR(monthlyBudget)}</strong>
              </div>
            </div>
            <aside className="panel estimate-card">
              <div className="estimate-top">
                <span className="estimate-icon"><Wallet size={18} /></span>
                <span className="estimate-tag">ILLUSTRATIVE ONLY</span>
              </div>
              <h3>Plan with a CPI lens</h3>
              <p className="estimate-copy">
                A simple scenario projection applies the latest national CPI change to the monthly
                amount you entered. It is not a forecast of your personal spending.
              </p>
              <div className="estimate-result">
                <span>Monthly amount after one year</span>
                <strong>{projectedBudget === null ? "Not available" : formatMyR(projectedBudget)}</strong>
                <small>
                  {yearOverYear === null
                    ? "Waiting for a matching year-ago CPI observation."
                    : `Uses the official ${yearOverYear.toFixed(1)}% year-on-year CPI change.`}
                </small>
              </div>
              <details className="assumptions">
                <summary>Show assumptions and calculation</summary>
                <ul>
                  <li>The sample categories and amounts are editable demonstration inputs, not official statistics.</li>
                  <li>The calculation assumes the latest CPI change repeats for the next 12 months.</li>
                  <li>National CPI represents an average basket; your actual price changes may differ.</li>
                  <li>Budget lines are stored only in this browser and are not uploaded to a server.</li>
                </ul>
                <code>monthly total × (1 + year-on-year CPI change ÷ 100)</code>
              </details>
              <p className="disclaimer">
                Illustrative planning tool only—not financial advice.
              </p>
            </aside>
          </div>
        </section>

        <section id="explorer" className="explorer-section">
          <div className="section-title-row">
            <div>
              <div className="panel-kicker">OPEN GOVERNMENT DATA</div>
              <h2>Explore the source records</h2>
              <p>Browse recent rows returned by the official data.gov.my APIs.</p>
            </div>
            <span className="data-license">CC BY 4.0 data</span>
          </div>
          <div className="panel explorer-panel">
            <div className="explorer-controls">
              <label className="explorer-select" htmlFor="dataset-select">
                <span className="sr-only">Choose dataset</span>
                <select
                  id="dataset-select"
                  value={explorerDataset}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (
                      value === "cpi_headline" ||
                      value === "cpi_state" ||
                      value === "fuelprice"
                    ) {
                      setLoadingExplorer(true);
                      setExplorerError(null);
                      setExplorerDataset(value);
                    }
                  }}
                >
                  {explorerOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </label>
              <label className="search-field">
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">Filter visible rows</span>
                <input
                  type="search"
                  placeholder="Filter these rows…"
                  value={explorerSearch}
                  onChange={(event) => setExplorerSearch(event.target.value)}
                />
              </label>
              <button
                className="export-button"
                type="button"
                onClick={exportExplorerCsv}
                disabled={!explorerRows.length}
              >
                <ArrowDownToLine size={15} /> Export CSV
              </button>
            </div>
            <div className="explorer-info" aria-live="polite">
              <span>
                {explorer?.meta.data_as_of
                  ? `Data as of ${displayDate(explorer.meta.data_as_of)}`
                  : explorer?.meta.last_updated
                    ? `Source updated ${displayDate(explorer.meta.last_updated)}`
                    : "Source release information will appear with the data"}
              </span>
              <span>
                {explorer?.stale ? "Showing last successful response" : `${explorerRows.length} rows shown · maximum 100`}
              </span>
            </div>
            {loadingExplorer ? (
              <div className="table-state" role="status">
                <span className="spinner" aria-hidden="true" /> Loading source records…
              </div>
            ) : explorerError ? (
              <div className="table-state error-placeholder" role="alert">{explorerError}</div>
            ) : explorerRows.length === 0 ? (
              <div className="table-state">No rows match this filter.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <caption className="sr-only">
                    Recent observations from {DATASET_OPTIONS.find((item) => item.id === explorerDataset)?.label}
                  </caption>
                  <thead>
                    <tr>
                      {explorerColumns.map((column) => (
                        <th key={column} scope="col">{column.replaceAll("_", " ")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {explorerRows.map((row, index) => (
                      <tr key={`${String(row.date)}-${index}`}>
                        {explorerColumns.map((column) => (
                          <td key={column}>
                            {row[column] === null || row[column] === undefined
                              ? "—"
                              : typeof row[column] === "number"
                                ? row[column]?.toLocaleString("en-MY", { maximumFractionDigits: 2 })
                                : String(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {explorer && (
              <div className="explorer-source">
                <span>
                  Source: {explorer.meta.data_source?.join(", ") ?? "Government of Malaysia"} ·{" "}
                  {explorer.meta.update_frequency?.toLowerCase() ?? "official dataset"}
                </span>
                <a
                  href={explorerDataset === "fuelprice" ? SOURCES.fuel : explorerDataset === "cpi_state" ? SOURCES.stateCpi : SOURCES.cpi}
                  target="_blank"
                  rel="noreferrer"
                >
                  Dataset methodology <ArrowUpRight size={13} />
                </a>
              </div>
            )}
          </div>
        </section>

        <footer className="page-footer">
          <span>Data: Department of Statistics Malaysia &amp; Ministry of Finance</span>
          <span>
            Licensed CC BY 4.0 ·{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              Attribution details <ArrowUpRight size={12} />
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
}
