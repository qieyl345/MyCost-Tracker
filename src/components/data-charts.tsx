"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  CpiRecord,
  FuelPriceRecord,
  StateCpiRecord,
} from "@/lib/datasets";

const COLORS = {
  teal: "#168a83",
  coral: "#e98a60",
  gold: "#d49a32",
  blue: "#5579b8",
  grid: "var(--chart-grid)",
  muted: "var(--muted)",
};

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function CpiTrendChart({ records }: { records: CpiRecord[] }) {
  return (
    <div
      className="chart-area"
      role="img"
      aria-label="Line chart showing Malaysia's overall consumer price index by month"
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={records} margin={{ top: 10, right: 12, bottom: 0, left: -14 }}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={monthLabel}
            tick={{ fill: COLORS.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: COLORS.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            labelFormatter={(value) => monthLabel(String(value))}
            formatter={(value) => [Number(value).toFixed(1), "Index (2010=100)"]}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--foreground)",
            }}
          />
          <Line
            type="monotone"
            dataKey="index"
            name="Malaysia overall"
            stroke={COLORS.teal}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: COLORS.teal }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StateCpiChart({
  records,
  selectedState,
}: {
  records: StateCpiRecord[];
  selectedState: string;
}) {
  const data = [...records]
    .sort((a, b) => a.index - b.index)
    .map((record) => ({ ...record, selected: record.state === selectedState }));

  return (
    <div
      className="chart-area state-chart"
      role="img"
      aria-label={`Horizontal bar chart comparing the consumer price index across ${data.length} Malaysian states`}
    >
      <ResponsiveContainer width="100%" height={330}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
          barCategoryGap={8}
        >
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 5" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, "auto"]}
            tick={{ fill: COLORS.muted, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="state"
            width={128}
            tick={{ fill: COLORS.muted, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) => [Number(value).toFixed(1), "Index (2010=100)"]}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--foreground)",
            }}
          />
          <Bar
            dataKey="index"
            name="CPI index"
            radius={[0, 5, 5, 0]}
            fill={COLORS.blue}
          >
            {data.map((record) => (
              <Cell
                key={record.state}
                fill={record.selected ? COLORS.teal : COLORS.blue}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FuelPriceChart({ records }: { records: FuelPriceRecord[] }) {
  return (
    <div
      className="chart-area"
      role="img"
      aria-label="Line chart showing official weekly retail fuel prices in ringgit per litre"
    >
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={records} margin={{ top: 10, right: 12, bottom: 0, left: -14 }}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={monthLabel}
            tick={{ fill: COLORS.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(value) => `RM${Number(value).toFixed(0)}`}
            tick={{ fill: COLORS.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={50}
          />
          <Tooltip
            labelFormatter={(value) => monthLabel(String(value))}
            formatter={(value) => [`RM ${Number(value).toFixed(2)}/L`]}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--foreground)",
            }}
          />
          <Legend wrapperStyle={{ color: COLORS.muted, fontSize: 12 }} />
          <Line
            type="stepAfter"
            dataKey="ron95"
            name="RON95"
            stroke={COLORS.teal}
            strokeWidth={2.2}
            dot={false}
            connectNulls
          />
          <Line
            type="stepAfter"
            dataKey="ron97"
            name="RON97"
            stroke={COLORS.coral}
            strokeWidth={2.2}
            dot={false}
            connectNulls
          />
          <Line
            type="stepAfter"
            dataKey="diesel"
            name="Diesel (Peninsular)"
            stroke={COLORS.gold}
            strokeWidth={2.2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
