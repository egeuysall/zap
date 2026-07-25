import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { CliError } from "./types";

const HOST = "127.0.0.1";
const PATH = "/callback";

function randomToken() {
  return randomBytes(32).toString("base64url");
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function openBrowser(url: string) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

function html(response: ServerResponse, status: number, body: string) {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(`<!doctype html><title>zap cli</title><body style="background:#0f0f0f;color:white;font:14px system-ui;display:grid;place-items:center;min-height:100vh">${body}</body>`);
}

export async function runBrowserLogin(endpoint: string) {
  const state = randomToken();
  const verifier = randomToken();
  const server = createServer();
  const redirectUri = await new Promise<string>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === "string") reject(new CliError("could not start login callback", "AUTH_ERROR", 2));
      else resolve(`http://${HOST}:${address.port}${PATH}`);
    });
  });
  const authUrl = new URL("/cli-auth", endpoint);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", hash(verifier));
  const successUrl = new URL("/cli-auth/success", endpoint);

  return await new Promise<{ apiKey: string }>((resolve, reject) => {
    const timeout = setTimeout(() => done(reject, new CliError("browser login timed out", "AUTH_TIMEOUT", 1)), 180_000);
    let settled = false;
    function done(fn: typeof resolve | typeof reject, value: { apiKey: string } | Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      setTimeout(() => server.close(() => fn(value as never)), 200);
    }
    server.on("request", (request: IncomingMessage, response: ServerResponse) => {
      void (async () => {
        const url = new URL(request.url ?? "/", redirectUri);
        if (request.method !== "GET" || url.pathname !== PATH) return html(response, 404, "not found");
        const code = url.searchParams.get("code");
        if (!code || url.searchParams.get("state") !== state) {
          html(response, 400, "invalid zap login response");
          return done(reject, new CliError("invalid browser login response", "AUTH_ERROR", 1));
        }
        const token = await fetch(new URL("/api/cli-auth/token", endpoint), {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ code, codeVerifier: verifier, redirectUri }),
        });
        const data = await token.json().catch(() => ({})) as { apiKey?: string; error?: string };
        if (!token.ok || !data.apiKey) {
          html(response, 500, "zap login failed");
          return done(reject, new CliError(data.error ?? "browser login failed", "AUTH_ERROR", 1));
        }
        response.writeHead(302, {
          "location": successUrl.toString(),
          "cache-control": "no-store",
        });
        response.end();
        done(resolve, { apiKey: data.apiKey });
      })();
    });
    process.stdout.write(`login url: ${authUrl}\n`);
    openBrowser(authUrl.toString());
  });
}
