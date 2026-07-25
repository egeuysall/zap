import path from "node:path";
import type {
  CompletionEvent,
  FailureEvent,
  LeaseResponse,
  ProgressEvent,
} from "./types";
import type { WorkerQueue } from "./queue-adapter";
import { parseJob } from "./validators";

export class ConvexHttpAdapter implements WorkerQueue {
  private readonly baseUrl: URL;
  private readonly token: string;
  private workerId: string | null = null;

  constructor(input: { baseUrl: string; token: string }) {
    this.baseUrl = new URL(input.baseUrl);
    this.token = input.token;
  }

  async lease(workerId: string): Promise<LeaseResponse> {
    this.workerId = workerId;
    const json = await this.post("/api/worker/jobs/lease", {
      workerId,
      leaseMs: 5 * 60_000,
    });
    if (!json || typeof json !== "object") {
      throw new Error("Lease response must be an object");
    }
    const job = (json as Record<string, unknown>).job;
    if (job === null) return null;
    if (!job || typeof job !== "object") {
      throw new Error("Lease response missing job");
    }
    const record = job as Record<string, unknown>;
    return parseJob({ ...record, id: record._id });
  }

  async progress(event: ProgressEvent): Promise<{ cancel?: boolean }> {
    return (await this.post("/api/worker/jobs/progress", {
      ...event,
      workerId: this.requireWorkerId(),
    })) as {
      cancel?: boolean;
    };
  }

  async complete(event: CompletionEvent): Promise<void> {
    await this.post("/api/worker/jobs/complete", {
      jobId: event.jobId,
      workerId: this.requireWorkerId(),
      storageId: event.storageId,
      title: titleFromFilename(event.filename),
      contentType: event.contentType,
      sizeBytes: event.bytes,
      durationSeconds: event.durationSeconds,
    });
  }

  async fail(event: FailureEvent): Promise<void> {
    await this.post("/api/worker/jobs/fail", {
      jobId: event.jobId,
      workerId: this.requireWorkerId(),
      error: event.error,
    });
  }

  async getUploadUrl(jobId: string, filename: string, contentType: string) {
    const json = await this.post("/api/worker/storage/upload-url", {
      jobId,
      workerId: this.requireWorkerId(),
      filename,
      contentType,
    });
    if (!json || typeof json !== "object") {
      throw new Error("Upload URL response must be an object");
    }
    const uploadUrl = (json as Record<string, unknown>).uploadUrl;
    if (typeof uploadUrl !== "string" || uploadUrl.length === 0) {
      throw new Error("Upload URL response missing uploadUrl");
    }
    return uploadUrl;
  }

  private requireWorkerId() {
    if (!this.workerId) throw new Error("Worker has not leased a job");
    return this.workerId;
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const url = new URL(path, this.baseUrl);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();

    if (!res.ok) {
      throw new Error(`Convex HTTP ${path} failed: ${res.status}${text ? ` ${text}` : ""}`);
    }
    if (res.status === 204 || !text) return null;
    return JSON.parse(text);
  }
}

export function titleFromFilename(filename: string) {
  return path.parse(filename).name.replace(/_+/g, " ").trim();
}
