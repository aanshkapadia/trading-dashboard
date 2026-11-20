import { NextResponse } from "next/server";
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { RobinhoodOAuthProvider, ROBINHOOD_MCP_URL } from "@/lib/robinhood/oauth";

export const dynamic = "force-dynamic";

// Starts the Robinhood OAuth flow (dynamic client registration + PKCE) and redirects to its login page.
export async function GET(req: Request) {
  const provider = new RobinhoodOAuthProvider();
  try {
    const result = await auth(provider, { serverUrl: ROBINHOOD_MCP_URL });
    if (result === "REDIRECT" && provider.authorizationUrl) {
      return NextResponse.redirect(provider.authorizationUrl.toString());
    }
    return NextResponse.redirect(new URL("/?connected=1", req.url));
  } catch (e) {
    const msg = encodeURIComponent((e as Error).message.slice(0, 200));
    return NextResponse.redirect(new URL(`/?auth_error=${msg}`, req.url));
  }
}
