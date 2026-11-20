import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

export const ROBINHOOD_MCP_URL =
  process.env.ROBINHOOD_MCP_URL ?? "https://agent.robinhood.com/mcp/trading";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const STORE_PATH = path.join(process.cwd(), ".data", "robinhood-auth.json");

interface AuthStore {
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
  state?: string;
}

async function readStore(): Promise<AuthStore> {
  try {
    return JSON.parse(await fs.readFile(STORE_PATH, "utf8")) as AuthStore;
  } catch {
    return {};
  }
}

async function writeStore(patch: Partial<AuthStore>): Promise<void> {
  const current = await readStore();
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify({ ...current, ...patch }, null, 2), { mode: 0o600 });
}

export async function clearAuth(): Promise<void> {
  await fs.rm(STORE_PATH, { force: true });
}

export async function hasTokens(): Promise<boolean> {
  return Boolean((await readStore()).tokens?.access_token);
}

export async function expectedState(): Promise<string | undefined> {
  return (await readStore()).state;
}

/**
 * Local, single-user OAuth provider for Robinhood's MCP server (dynamic client registration + PKCE).
 * Credentials live in .data/robinhood-auth.json (gitignored). This app is meant to run on your own
 * machine; for a hosted deploy, swap the file store for an encrypted per-user store.
 */
export class RobinhoodOAuthProvider implements OAuthClientProvider {
  /** Set when the SDK wants the user sent to Robinhood's login page. */
  public authorizationUrl: URL | null = null;

  get redirectUrl(): string {
    return `${APP_URL}/api/auth/callback`;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "trading-dashboard (local)",
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }

  async state(): Promise<string> {
    const state = crypto.randomBytes(16).toString("hex");
    await writeStore({ state });
    return state;
  }

  async clientInformation() {
    return (await readStore()).clientInformation;
  }

  async saveClientInformation(info: OAuthClientInformationMixed) {
    await writeStore({ clientInformation: info });
  }

  async tokens() {
    return (await readStore()).tokens;
  }

  async saveTokens(tokens: OAuthTokens) {
    await writeStore({ tokens });
  }

  redirectToAuthorization(url: URL) {
    this.authorizationUrl = url;
  }

  async saveCodeVerifier(codeVerifier: string) {
    await writeStore({ codeVerifier });
  }

  async codeVerifier() {
    const v = (await readStore()).codeVerifier;
    if (!v) throw new Error("No PKCE code verifier saved. Start the login again.");
    return v;
  }

  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery") {
    if (scope === "all") return clearAuth();
    if (scope === "tokens") return writeStore({ tokens: undefined });
    if (scope === "client") return writeStore({ clientInformation: undefined });
    if (scope === "verifier") return writeStore({ codeVerifier: undefined });
  }
}
