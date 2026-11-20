import { NextResponse } from "next/server";
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { RobinhoodOAuthProvider, ROBINHOOD_MCP_URL, expectedState } from "@/lib/robinhood/oauth";
import { resetClient } from "@/lib/robinhood/client";

export const dynamic = "force-dynamic";

// Robinhood redirects back here with ?code=...&state=... after you sign in.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const fail = (m: string) => NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(m)}`, req.url));
  if (error) return fail(error);
  if (!code) return fail("Missing authorization code");

  const saved = await expectedState();
  if (saved && state !== saved) return fail("State mismatch. Try connecting again.");

  try {
    await auth(new RobinhoodOAuthProvider(), { serverUrl: ROBINHOOD_MCP_URL, authorizationCode: code });
    resetClient();
    return NextResponse.redirect(new URL("/?connected=1", req.url));
  } catch (e) {
    return fail((e as Error).message.slice(0, 200));
  }
}
