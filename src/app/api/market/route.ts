import { NextResponse } from "next/server";
import { getMarketData } from "@/lib/data";
import { BENCHMARK, MAX_SYMBOLS } from "@/lib/config";

export const dynamic = "force-dynamic";

// GET /api/market?symbols=NVDA,GOOGL&refresh=1&sample=1
// Returns ~2 years of daily bars + fundamentals. Signals are computed in the browser so sliders are instant.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z.]{1,6}$/.test(s));
  if (!symbols.includes(BENCHMARK)) symbols.push(BENCHMARK);

  try {
    const data = await getMarketData(symbols.slice(0, MAX_SYMBOLS), {
      force: url.searchParams.get("refresh") === "1",
      sample: url.searchParams.get("sample") === "1",
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
