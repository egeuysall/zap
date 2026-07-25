import { httpRouter } from "convex/server";
import type { FunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();
const internalApi = internal as unknown as {
  downloads: {
    leaseNext: FunctionReference<
      "mutation",
      "internal",
      { workerId: string; leaseMs: number },
      unknown
    >;
    updateFromWorker: FunctionReference<
      "mutation",
      "internal",
      {
        jobId: Id<"downloadJobs">;
        workerId: string;
        state: "processing" | "completed" | "failed" | "cancelled";
        progress?: number;
        error?: string;
        storageId?: Id<"_storage">;
        thumbnailStorageId?: Id<"_storage">;
        title?: string;
        contentType?: string;
        durationSeconds?: number;
        sizeBytes?: number;
      },
      unknown
    >;
  };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function authorize(request: Request) {
  const secret = process.env.WORKER_SECRET;
  const header = request.headers.get("authorization");
  return Boolean(secret) && header === `Bearer ${secret}`;
}

async function bodyObject(request: Request) {
  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid JSON body");
  }
  return body as Record<string, unknown>;
}

function textField(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (typeof value !== "string") throw new Error(`${key} is required`);
  return value;
}

function optionalText(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
}

function optionalNumber(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a number`);
  }
  return value;
}

function jobId(body: Record<string, unknown>) {
  return textField(body, "jobId") as Id<"downloadJobs">;
}

function storageId(value: string | undefined) {
  return value as Id<"_storage"> | undefined;
}

function workerState(
  state: string,
): "processing" | "completed" | "failed" | "cancelled" {
  if (
    state === "processing" ||
    state === "completed" ||
    state === "failed" ||
    state === "cancelled"
  ) {
    return state;
  }
  throw new Error("Invalid state");
}

async function updateJob(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  body: Record<string, unknown>,
  state: "processing" | "completed" | "failed" | "cancelled",
) {
  return await ctx.runMutation(internalApi.downloads.updateFromWorker, {
    jobId: jobId(body),
    workerId: textField(body, "workerId"),
    state,
    progress: optionalNumber(body, "progress"),
    error: optionalText(body, "error"),
    storageId: storageId(optionalText(body, "storageId")),
    thumbnailStorageId: storageId(optionalText(body, "thumbnailStorageId")),
    title: optionalText(body, "title"),
    contentType: optionalText(body, "contentType"),
    durationSeconds: optionalNumber(body, "durationSeconds"),
    sizeBytes: optionalNumber(body, "sizeBytes"),
  });
}

http.route({
  path: "/api/worker/jobs/lease",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorize(request)) return json({ error: "Unauthorized" }, 401);
    try {
      const body = await bodyObject(request);
      const workerId = textField(body, "workerId");
      const leaseMs = optionalNumber(body, "leaseMs") ?? 5 * 60_000;
      const job = await ctx.runMutation(internalApi.downloads.leaseNext, {
        workerId,
        leaseMs,
      });
      return json({ job });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Bad request" }, 400);
    }
  }),
});

http.route({
  path: "/api/worker/jobs/progress",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorize(request)) return json({ error: "Unauthorized" }, 401);
    try {
      const body = await bodyObject(request);
      const result = await updateJob(ctx, body, "processing");
      const cancelled =
        result !== null &&
        typeof result === "object" &&
        "cancelled" in result &&
        result.cancelled === true;
      return json({ ok: true, cancel: cancelled });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Bad request" }, 400);
    }
  }),
});

http.route({
  path: "/api/worker/jobs/complete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorize(request)) return json({ error: "Unauthorized" }, 401);
    try {
      const body = await bodyObject(request);
      await updateJob(ctx, body, "completed");
      return json({ ok: true });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Bad request" }, 400);
    }
  }),
});

http.route({
  path: "/api/worker/jobs/fail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorize(request)) return json({ error: "Unauthorized" }, 401);
    try {
      const body = await bodyObject(request);
      await updateJob(ctx, body, "failed");
      return json({ ok: true });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Bad request" }, 400);
    }
  }),
});

http.route({
  path: "/api/worker/jobs/update",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorize(request)) return json({ error: "Unauthorized" }, 401);
    try {
      const body = await bodyObject(request);
      await updateJob(ctx, body, workerState(textField(body, "state")));
      return json({ ok: true });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Bad request" }, 400);
    }
  }),
});

http.route({
  path: "/api/worker/storage/upload-url",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorize(request)) return json({ error: "Unauthorized" }, 401);
    return json({ uploadUrl: await ctx.storage.generateUploadUrl() });
  }),
});

export default http;
