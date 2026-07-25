import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { CliError } from "./types";

export const DOWNLOADS_DIR = path.join(os.homedir(), "Downloads");

export async function saveRemoteFile(url: string, title = "zap-download", format: "mp4" | "mp3" = "mp4") {
  await mkdir(DOWNLOADS_DIR, { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new CliError(`file download failed with ${response.status}`, "DOWNLOAD_FAILED", 2);
  if (!response.body) throw new CliError("file response was empty", "DOWNLOAD_FAILED", 2);
  const file = await nextDownloadPath(title, format);
  const tmp = path.join(DOWNLOADS_DIR, `.zap-${randomUUID()}.tmp`);
  try {
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(tmp, { flags: "wx" }));
    await rename(tmp, file);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
  return file;
}

export async function nextDownloadPath(title: string, ext: string, dir = DOWNLOADS_DIR) {
  const base = safeName(title);
  for (let index = 0; ; index += 1) {
    const file = path.join(dir, `${base}${index ? `-${index + 1}` : ""}.${ext}`);
    if (!(await exists(file))) return file;
  }
}

export function safeName(value: string) {
  return value.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "zap-download";
}

async function exists(file: string) {
  return Boolean(await stat(file).catch(() => null));
}
