import { NextResponse } from "next/server";
import { getPortfolio } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = await getPortfolio({
    force: url.searchParams.get("refresh") === "1",
    sample: url.searchParams.get("sample") === "1",
  });
  return NextResponse.json(data);
}
