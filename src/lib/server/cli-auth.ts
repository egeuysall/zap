import "server-only";

import { createHash, randomBytes } from "node:crypto";

const PARAM = /^[A-Za-z0-9_-]{32,256}$/;
const LOOPBACK = new Set(["127.0.0.1", "localhost"]);

export const CLI_AUTH_TTL_MS = 5 * 60_000;

export function randomCliValue(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashCliValue(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function normalizeCliParam(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return PARAM.test(normalized) ? normalized : null;
}

export function normalizeCliRedirect(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const port = Number(url.port);
    if (
      url.protocol !== "http:" ||
      !LOOPBACK.has(url.hostname) ||
      !Number.isInteger(port) ||
      port < 1024 ||
      port > 65535 ||
      url.username ||
      url.password ||
      url.hash
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function cliApiKeyHash(request: Request) {
  const raw = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!raw?.match(/^zak_[A-Za-z0-9_-]{32,128}$/)) return null;
  return hashCliValue(raw);
}
