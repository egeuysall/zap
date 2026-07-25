import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { DownloadJob, OutputFormat, OutputKind } from "./types";

const FORMAT_KIND: Record<OutputFormat, OutputKind> = {
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  mp4: "video",
  webm: "video",
};

const PRIVATE_HOSTS = new Set(["localhost", "localhost.localdomain"]);

export function normalizeOutputFormat(format: unknown): OutputFormat {
  if (
    format === "mp3" ||
    format === "m4a" ||
    format === "wav" ||
    format === "mp4" ||
    format === "webm"
  ) {
    return format;
  }
  return "mp3";
}

export function outputKindFor(format: OutputFormat): OutputKind {
  return FORMAT_KIND[format];
}

export function canonicalHttpUrl(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 2048) {
    throw new Error("URL must be a string up to 2048 characters");
  }

  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported");
  }
  if (url.username || url.password) {
    throw new Error("URL credentials are not allowed");
  }
  if (!url.hostname) {
    throw new Error("URL hostname is required");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error("Local and private network URLs are not allowed");
  }

  url.hash = "";
  return url.href;
}

export async function assertPublicHttpUrl(raw: unknown): Promise<string> {
  const canonical = canonicalHttpUrl(raw);
  const hostname = new URL(canonical).hostname;
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!isSupportedVideoHost(host)) {
    throw new Error("Only YouTube video URLs are supported");
  }

  if (isIP(hostname) === 0) {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
      throw new Error("URL resolves to a local or private network address");
    }
  }

  return canonical;
}

function isSupportedVideoHost(host: string) {
  return host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com");
}

export function parseJob(value: unknown): DownloadJob | null {
  if (value === null) return null;
  if (!value || typeof value !== "object") {
    throw new Error("Lease response must be an object or null");
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.length === 0) {
    throw new Error("Job id is required");
  }

  const format = normalizeOutputFormat(record.format);
  return {
    id: record.id,
    url: canonicalHttpUrl(record.url),
    kind: record.kind === "video" ? "video" : outputKindFor(format),
    format,
    quality:
      record.quality === "1080p" ||
      record.quality === "720p" ||
      record.quality === "480p" ||
      record.quality === "audio"
        ? record.quality
        : "best",
    uploadUrl:
      typeof record.uploadUrl === "string" && record.uploadUrl.length > 0
        ? canonicalHttpUrl(record.uploadUrl)
        : undefined,
    filename:
      typeof record.filename === "string" && record.filename.length > 0
        ? safeFilename(record.filename)
        : undefined,
  };
}

export function safeFilename(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned || "download";
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  return PRIVATE_HOSTS.has(lower) || isPrivateIp(lower);
}

function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a >= 224 && a <= 255)
    );
  }

  if (version === 6) {
    const lower = ip.toLowerCase();
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80:") ||
      lower.startsWith("::ffff:127.") ||
      lower.startsWith("::ffff:10.") ||
      lower.startsWith("::ffff:192.168.")
    );
  }

  return false;
}
