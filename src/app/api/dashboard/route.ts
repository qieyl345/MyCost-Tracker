import { NextResponse } from "next/server";
import { fetchDashboardData, normalizeMonths } from "@/lib/data-client";

export async function GET(request: Request) {
  const months = normalizeMonths(new URL(request.url).searchParams.get("months"));
  const result = await fetchDashboardData(months);
  const payload = { ...result, months };
  const hasData = Object.values(result).some((dataset) => dataset.data.length > 0);

  return NextResponse.json(payload, {
    status: hasData ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
