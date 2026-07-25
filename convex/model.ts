import type { MutationCtx, QueryCtx } from "./_generated/server";

type AuthCtx = QueryCtx | MutationCtx;

export async function requireIdentity(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

export async function getOrCreateProfile(ctx: MutationCtx) {
  const identity = await requireIdentity(ctx);
  const now = Date.now();
  const existing = await ctx.db
    .query("profiles")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  const patch = {
    name: identity.name ?? undefined,
    email: identity.email ?? undefined,
    imageUrl: identity.pictureUrl ?? undefined,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch("profiles", existing._id, patch);
    return existing._id;
  }

  return await ctx.db.insert("profiles", {
    tokenIdentifier: identity.tokenIdentifier,
    ...patch,
    createdAt: now,
  });
}

export async function ownerFromApiKeyHash(ctx: AuthCtx, keyHash: string) {
  assertLength(keyHash, "keyHash", 128);
  const key = await ctx.db
    .query("apiKeys")
    .withIndex("by_keyHash", (q) => q.eq("keyHash", keyHash))
    .unique();
  if (!key) throw new Error("Not authenticated");
  return key.ownerTokenIdentifier;
}

export function assertLength(value: string, name: string, max: number) {
  if (value.trim().length === 0) throw new Error(`${name} is required`);
  if (value.length > max) throw new Error(`${name} is too long`);
}

export function assertDownloadUrl(value: string) {
  assertLength(value, "url", 2048);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("URL must use HTTP or HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("URL credentials are not allowed");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!isSupportedVideoHost(host)) {
    throw new Error("Only YouTube video URLs are supported");
  }
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1"
  ) {
    throw new Error("Local and private network URLs are not allowed");
  }
}

function isSupportedVideoHost(host: string) {
  return host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com");
}

export function assertProgress(value: number | undefined) {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Progress must be between 0 and 100");
  }
}

export function assertFormatQuality(format: string, quality: string) {
  if (format === "mp4" && quality === "audio") {
    throw new Error("Audio quality requires MP3 format");
  }
}
