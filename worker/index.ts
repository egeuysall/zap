import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { buildFfprobeArgs, buildYtDlpArgs, contentTypeFor } from "./commands";
import { ConvexHttpAdapter } from "./convex-http-adapter";
import { RedisStreamsAdapter } from "./redis-streams-adapter";
import type { WorkerQueue } from "./queue-adapter";
import type { DownloadJob, OutputFormat, ProgressEvent } from "./types";
import { assertPublicHttpUrl, normalizeOutputFormat } from "./validators";

const WORKER_ID = process.env.WORKER_ID ?? `downloader-${process.pid}`;
const POLL_MS = numberEnv("WORKER_POLL_MS", 5000);
const JOB_TIMEOUT_MS = numberEnv("WORKER_JOB_TIMEOUT_MS", 20 * 60 * 1000);
const YT_DLP_BIN = process.env.YT_DLP_BIN ?? "yt-dlp";
const FFPROBE_BIN = process.env.FFPROBE_BIN ?? "ffprobe";

async function main() {
  const adapter = createAdapter();

  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));

  for (;;) {
    const job = await adapter.lease(WORKER_ID);
    if (!job) {
      await sleep(POLL_MS);
      continue;
    }
    await runJob(adapter, job).catch(async (error) => {
      await adapter.fail({
        jobId: job.id,
        error: error instanceof Error ? error.message : "Unknown worker error",
        retryable: true,
      });
    });
  }
}

function createAdapter(): WorkerQueue {
  if (process.env.WORKER_QUEUE === "redis") {
    return new RedisStreamsAdapter({
      url: requiredEnv("REDIS_URL"),
      jobsStream: process.env.REDIS_JOBS_STREAM,
      eventsStream: process.env.REDIS_EVENTS_STREAM,
      group: process.env.REDIS_GROUP,
    });
  }

  return new ConvexHttpAdapter({
    baseUrl: requiredEnv("WORKER_API_BASE_URL"),
    token: requiredEnv("WORKER_TOKEN"),
  });
}

async function runJob(adapter: WorkerQueue, job: DownloadJob) {
  const format = normalizeOutputFormat(job.format);
  const url = await assertPublicHttpUrl(job.url);
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), `zap-${job.id}-`));

  try {
    await checkedProgress(adapter, {
      jobId: job.id,
      status: "leased",
      message: "Job leased",
    });

    await runProcess(
      YT_DLP_BIN,
      buildYtDlpArgs({
        url,
        outputDir: tmpDir,
        format,
        quality: job.quality,
        filename: job.filename,
      }),
      JOB_TIMEOUT_MS,
      async (line) => {
        const progress = parsePercent(line);
        if (progress !== null) {
          await checkedProgress(adapter, {
            jobId: job.id,
            status: "downloading",
            progress,
          });
        }
      },
    );

    await checkedProgress(adapter, {
      jobId: job.id,
      status: "processing",
      progress: 100,
    });

    const file = await findArtifact(tmpDir, format);
    const metadata = await validateArtifact(file);
    const fileStat = await stat(file);
    const contentType = contentTypeFor(format);
    const uploadUrl =
      job.uploadUrl ??
      (await adapter.getUploadUrl?.(job.id, path.basename(file), contentType));
    if (!uploadUrl) throw new Error("No artifact upload URL available");

    await checkedProgress(adapter, {
      jobId: job.id,
      status: "uploading",
      progress: 100,
    });

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "content-type": contentType },
      body: Bun.file(file),
    });
    if (!uploadRes.ok) {
      const detail = await uploadRes.text().catch(() => "");
      throw new Error(`Artifact upload failed: ${uploadRes.status}${detail ? ` ${detail}` : ""}`);
    }
    const uploadJson = await uploadRes.json().catch(() => null);
    const storageId =
      uploadJson && typeof uploadJson === "object"
        ? String((uploadJson as Record<string, unknown>).storageId ?? "")
        : undefined;

    await adapter.complete({
      jobId: job.id,
      storageId: storageId || undefined,
      artifact: uploadJson,
      filename: path.basename(file),
      contentType,
      bytes: fileStat.size,
      durationSeconds: metadata.durationSeconds,
    });
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function checkedProgress(adapter: WorkerQueue, event: ProgressEvent) {
  const result = await adapter.progress(event);
  if (result.cancel) throw new Error("Job cancelled");
}

async function findArtifact(dir: string, format: OutputFormat): Promise<string> {
  const files = await readdir(dir);
  const file = files.find((name) => name.endsWith(`.${format}`));
  if (!file) throw new Error(`No .${format} artifact created`);
  return path.join(dir, file);
}

async function validateArtifact(file: string) {
  const output = await runProcess(FFPROBE_BIN, buildFfprobeArgs(file), 30_000);
  return parseMediaMetadata(output);
}

export function parseMediaMetadata(output: string) {
  const data = JSON.parse(output || "{}") as {
    format?: { duration?: string; size?: string };
  };
  const duration = Number(data.format?.duration);
  const size = Number(data.format?.size);
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(size) || size <= 0) {
    throw new Error("Downloaded artifact failed media validation");
  }
  return { durationSeconds: duration, sizeBytes: size };
}

export async function runProcess(
  command: string,
  args: string[],
  timeoutMs: number,
  onLine?: (line: string) => void | Promise<void>,
): Promise<string> {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  const timeout = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
  let output = "";
  let stderr = "";
  let lineBuffer = "";
  let callbackError: unknown;
  let callbacks = Promise.resolve();

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    output += chunk;
    if (!onLine) return;
    lineBuffer += chunk;
    const lines = lineBuffer.split(/\r?\n/);
    lineBuffer = lines.pop() ?? "";
    callbacks = callbacks
      .then(async () => {
        if (callbackError) return;
        for (const line of lines) {
          if (line) await onLine(line);
        }
      })
      .catch((error) => {
        callbackError = error;
        child.kill("SIGTERM");
      });
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const code = await new Promise<number | null>((resolve) => {
    child.on("exit", resolve);
  });
  clearTimeout(timeout);
  if (onLine && lineBuffer && !callbackError) {
    callbacks = callbacks.then(() => onLine(lineBuffer));
  }
  await callbacks;
  if (callbackError) throw callbackError;
  if (code !== 0) {
    throw new Error(`${command} exited ${code}: ${stderr.slice(-1000)}`);
  }
  return output;
}

function parsePercent(line: string): number | null {
  const match = line.match(/(\d+(?:\.\d+)?)%/);
  if (!match) return null;
  return Math.min(100, Math.max(0, Number(match[1])));
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
