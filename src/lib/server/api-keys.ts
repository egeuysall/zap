import "server-only";

import { createHash, randomBytes } from "node:crypto";

const PREFIX = "zak_";

export function createApiKey() {
  const rawKey = `${PREFIX}${randomBytes(32).toString("base64url")}`;
  return {
    rawKey,
    keyHash: hashApiKey(rawKey),
    prefix: PREFIX,
    last4: rawKey.slice(-4),
  };
}

export function hashApiKey(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function readApiKey(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;
}

export function isZapApiKey(value: string | null) {
  return Boolean(value?.startsWith(PREFIX));
}
