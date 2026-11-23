import type { CpiRecord } from "./datasets";

export type BudgetLine = {
  id: string;
  label: string;
  amount: number;
};

export const STARTER_BUDGET: BudgetLine[] = [
  { id: "housing", label: "Housing", amount: 1200 },
  { id: "food", label: "Food", amount: 650 },
  { id: "transport", label: "Transport", amount: 250 },
  { id: "utilities", label: "Utilities", amount: 180 },
  { id: "other", label: "Other", amount: 120 },
];

export function calculateBudgetTotal(lines: BudgetLine[]) {
  return lines.reduce(
    (total, line) => total + (Number.isFinite(line.amount) ? line.amount : 0),
    0,
  );
}

export function calculateInflationAdjustedTotal(
  amount: number,
  yearOverYearPercent: number,
) {
  return amount * (1 + yearOverYearPercent / 100);
}

export function calculateYearOverYearChange(records: CpiRecord[]) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted.at(-1);
  if (!current) return null;

  const previousDate = new Date(`${current.date}T00:00:00.000Z`);
  previousDate.setUTCFullYear(previousDate.getUTCFullYear() - 1);
  const previousKey = previousDate.toISOString().slice(0, 10);
  const previous = sorted.find((record) => record.date === previousKey);
  if (!previous || previous.index <= 0) return null;

  return ((current.index / previous.index) - 1) * 100;
}

export function formatMyR(amount: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 2,
  }).format(amount);
}
