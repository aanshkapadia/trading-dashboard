import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { RobinhoodOAuthProvider, ROBINHOOD_MCP_URL } from "./oauth";

/**
 * READ-ONLY allowlist. The Robinhood MCP also exposes order, alert and watchlist write tools;
 * this app never calls them. Anything not on this list throws before it reaches the network.
 */
const READ_ONLY_TOOLS = new Set([
  "get_accounts",
  "get_portfolio",
  "get_equity_positions",
  "get_option_positions",
  "get_option_instruments",
  "get_equity_quotes",
  "get_equity_historicals",
  "get_equity_fundamentals",
  "get_earnings_calendar",
]);

export class NotConnectedError extends Error {
  constructor() {
    super("Robinhood is not connected. Use “Connect Robinhood” to sign in.");
  }
}

type Cached = { client: Client; connectedAt: number };
const g = globalThis as unknown as { __rhClient?: Cached };

async function connect(): Promise<Client> {
  if (g.__rhClient && Date.now() - g.__rhClient.connectedAt < 30 * 60_000) return g.__rhClient.client;

  const provider = new RobinhoodOAuthProvider();
  if (!(await provider.tokens())) throw new NotConnectedError();

  const client = new Client({ name: "trading-dashboard", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(ROBINHOOD_MCP_URL), { authProvider: provider });
  try {
    await client.connect(transport);
  } catch (err) {
    // The SDK refreshes tokens on its own; if it still wants a browser login we're disconnected.
    if (provider.authorizationUrl) throw new NotConnectedError();
    throw err;
  }
  g.__rhClient = { client, connectedAt: Date.now() };
  return client;
}

/** Calls a read-only Robinhood MCP tool and returns the parsed `data` payload. */
export async function callReadTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!READ_ONLY_TOOLS.has(name)) throw new Error(`Tool "${name}" is not on the read-only allowlist.`);

  const run = async () => {
    const client = await connect();
    const res = await client.callTool({ name, arguments: args });
    const content = (res.content ?? []) as Array<{ type: string; text?: string }>;
    const text = content.find((c) => c.type === "text")?.text ?? "";
    if (res.isError) throw new Error(`${name} failed: ${text.slice(0, 300)}`);
    const parsed = JSON.parse(text) as { data?: T };
    return (parsed.data ?? parsed) as T;
  };

  try {
    return await run();
  } catch (err) {
    if (err instanceof NotConnectedError) throw err;
    // One retry on a fresh connection (stale session, network blip).
    g.__rhClient = undefined;
    return run();
  }
}

export function resetClient() {
  g.__rhClient = undefined;
}
