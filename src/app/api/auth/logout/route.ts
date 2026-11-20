import { NextResponse } from "next/server";
import { clearAuth } from "@/lib/robinhood/oauth";
import { resetClient } from "@/lib/robinhood/client";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearAuth();
  resetClient();
  return NextResponse.json({ ok: true });
}
