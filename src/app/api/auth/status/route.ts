import { NextResponse } from "next/server";
import { hasTokens } from "@/lib/robinhood/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    connected: await hasTokens(),
    forcedSample: process.env.DATA_SOURCE === "sample",
  });
}
