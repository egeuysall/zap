import type { WorkerQueue } from "./queue-adapter";
import type {
  CompletionEvent,
  DownloadJob,
  FailureEvent,
  ProgressEvent,
} from "./types";
import { parseJob } from "./validators";

type RedisClient = {
  connect(): Promise<void>;
  close(): void;
  send(command: string, args: string[]): Promise<unknown>;
};

const BunRuntime = globalThis as typeof globalThis & {
  Bun?: { RedisClient?: new (url?: string) => RedisClient };
};

export class RedisStreamsAdapter implements WorkerQueue {
  private readonly redis: RedisClient;
  private readonly jobsStream: string;
  private readonly eventsStream: string;
  private readonly group: string;
  private lastEntryId: string | null = null;

  constructor(input: {
    url: string;
    jobsStream?: string;
    eventsStream?: string;
    group?: string;
  }) {
    const RedisClient = BunRuntime.Bun?.RedisClient;
    if (!RedisClient) {
      throw new Error("Bun.RedisClient is not available in this Bun runtime");
    }
    this.redis = new RedisClient(input.url);
    this.jobsStream = input.jobsStream ?? "zap:downloads";
    this.eventsStream = input.eventsStream ?? "zap:download-events";
    this.group = input.group ?? "downloaders";
  }

  async lease(workerId: string): Promise<DownloadJob | null> {
    await this.redis.connect();
    await this.ensureGroup();
    const response = await this.redis.send("XREADGROUP", [
      "GROUP",
      this.group,
      workerId,
      "COUNT",
      "1",
      "BLOCK",
      "1000",
      "STREAMS",
      this.jobsStream,
      ">",
    ]);
    const entry = parseRedisStreamResponse(response);
    if (!entry) return null;
    this.lastEntryId = entry.entryId;
    return parseJob({ id: entry.fields.jobId ?? entry.entryId, ...entry.fields });
  }

  async progress(event: ProgressEvent): Promise<{ cancel?: boolean }> {
    await this.addEvent("progress", event);
    return {};
  }

  async complete(event: CompletionEvent): Promise<void> {
    await this.addEvent("complete", event);
    await this.ackLast();
  }

  async fail(event: FailureEvent): Promise<void> {
    await this.addEvent("fail", event);
    await this.ackLast();
  }

  async getUploadUrl(): Promise<string> {
    throw new Error("Redis jobs must include uploadUrl for artifact storage");
  }

  private async ensureGroup() {
    try {
      await this.redis.send("XGROUP", [
        "CREATE",
        this.jobsStream,
        this.group,
        "0",
        "MKSTREAM",
      ]);
    } catch (error) {
      if (!String(error).includes("BUSYGROUP")) throw error;
    }
  }

  private async addEvent(type: string, event: unknown) {
    await this.redis.send("XADD", [
      this.eventsStream,
      "*",
      "type",
      type,
      "payload",
      JSON.stringify(event),
    ]);
  }

  private async ackLast() {
    if (!this.lastEntryId) return;
    await this.redis.send("XACK", [this.jobsStream, this.group, this.lastEntryId]);
    this.lastEntryId = null;
  }
}

export function parseRedisStreamResponse(value: unknown):
  | { entryId: string; fields: Record<string, string> }
  | null {
  if (!Array.isArray(value) || !Array.isArray(value[0])) return null;
  const entries = value[0][1];
  if (!Array.isArray(entries) || !Array.isArray(entries[0])) return null;
  const [entryId, pairs] = entries[0];
  if (typeof entryId !== "string" || !Array.isArray(pairs)) return null;

  const fields: Record<string, string> = {};
  for (let i = 0; i < pairs.length; i += 2) {
    if (typeof pairs[i] === "string" && typeof pairs[i + 1] === "string") {
      fields[pairs[i]] = pairs[i + 1];
    }
  }

  if (fields.payload) {
    return { entryId, fields: JSON.parse(fields.payload) as Record<string, string> };
  }
  return { entryId, fields };
}
