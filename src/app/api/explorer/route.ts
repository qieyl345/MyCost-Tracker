import { NextResponse } from "next/server";
import {
  fetchExplorerData,
  normalizeMonths,
} from "@/lib/data-client";
import type { DatasetId } from "@/lib/datasets";
import { OpenDataError } from "@/lib/response-parser";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const datasetParam = search.get("dataset");
  if (
    datasetParam !== "cpi_headline" &&
    datasetParam !== "cpi_state" &&
    datasetParam !== "fuelprice"
  ) {
    return NextResponse.json(
      { error: "Select one of the supported official datasets." },
      { status: 400 },
    );
  }
  const requestedId: DatasetId = datasetParam;

  const months = normalizeMonths(search.get("months"));
  const limit = Number(search.get("limit")) || 100;
  try {
    const result = await fetchExplorerData(requestedId, months, limit);
    return NextResponse.json(
      { ...result, datasetId: requestedId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof OpenDataError && error.status === 429 ? 429 : 503;
    return NextResponse.json(
      {
        error:
          status === 429
            ? "The official API is rate-limiting requests. Please try again shortly."
            : `Could not load ${requestedId} from the official API.`,
      },
      { status },
    );
  }
}
