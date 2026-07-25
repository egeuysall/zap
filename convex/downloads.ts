import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { downloadFormat, downloadQuality, jobState } from "./validators";
import {
  assertDownloadUrl,
  assertFormatQuality,
  assertLength,
  assertProgress,
  getOrCreateProfile,
  ownerFromApiKeyHash,
  requireIdentity,
} from "./model";

async function jobWithUrls(ctx: QueryCtx, job: Doc<"downloadJobs">) {
  const video = job.videoId ? await ctx.db.get(job.videoId) : null;
  return {
    ...job,
    videoUrl: video ? await ctx.storage.getUrl(video.storageId) : null,
    thumbnailUrl: video?.thumbnailStorageId
      ? await ctx.storage.getUrl(video.thumbnailStorageId)
      : null,
  };
}

export const createJob = mutation({
  args: {
    url: v.string(),
    format: downloadFormat,
    quality: downloadQuality,
  },
  handler: async (ctx, args) => {
    await getOrCreateProfile(ctx);
    const identity = await requireIdentity(ctx);
    assertDownloadUrl(args.url);
    assertFormatQuality(args.format, args.quality);
    const now = Date.now();
    return await ctx.db.insert("downloadJobs", {
      ownerTokenIdentifier: identity.tokenIdentifier,
      url: args.url.trim(),
      format: args.format,
      quality: args.quality,
      state: "queued",
      progress: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createJobForApiKey = mutation({
  args: {
    keyHash: v.string(),
    url: v.string(),
    format: downloadFormat,
    quality: downloadQuality,
  },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await ownerFromApiKeyHash(ctx, args.keyHash);
    assertDownloadUrl(args.url);
    assertFormatQuality(args.format, args.quality);
    const now = Date.now();
    return await ctx.db.insert("downloadJobs", {
      ownerTokenIdentifier,
      url: args.url.trim(),
      format: args.format,
      quality: args.quality,
      state: "queued",
      progress: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getMine = query({
  args: { jobId: v.id("downloadJobs") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const job = await ctx.db.get("downloadJobs", args.jobId);
    if (!job || job.ownerTokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Not found");
    }
    return await jobWithUrls(ctx, job);
  },
});

export const getForApiKey = query({
  args: { keyHash: v.string(), jobId: v.id("downloadJobs") },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await ownerFromApiKeyHash(ctx, args.keyHash);
    const job = await ctx.db.get(args.jobId);
    if (!job || job.ownerTokenIdentifier !== ownerTokenIdentifier) {
      throw new Error("Not found");
    }
    return await jobWithUrls(ctx, job);
  },
});

export const listMine = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    return await ctx.db
      .query("downloadJobs")
      .withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
        q.eq("ownerTokenIdentifier", identity.tokenIdentifier),
      )
      .order("desc")
      .take(limit);
  },
});

export const listForApiKey = query({
  args: { keyHash: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await ownerFromApiKeyHash(ctx, args.keyHash);
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    return await ctx.db
      .query("downloadJobs")
      .withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
        q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
      )
      .order("desc")
      .take(limit);
  },
});

export const cancel = mutation({
  args: { jobId: v.id("downloadJobs") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const job = await ctx.db.get("downloadJobs", args.jobId);
    if (!job || job.ownerTokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Not found");
    }
    if (job.state === "completed" || job.state === "failed") {
      return { jobId: job._id, state: job.state, cancelled: false };
    }
    await ctx.db.patch("downloadJobs", job._id, {
      state: "cancelled",
      updatedAt: Date.now(),
      leaseExpiresAt: undefined,
    });
    return { jobId: job._id, state: "cancelled" as const, cancelled: true };
  },
});

export const cancelForApiKey = mutation({
  args: { keyHash: v.string(), jobId: v.id("downloadJobs") },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await ownerFromApiKeyHash(ctx, args.keyHash);
    const job = await ctx.db.get(args.jobId);
    if (!job || job.ownerTokenIdentifier !== ownerTokenIdentifier) {
      throw new Error("Not found");
    }
    if (job.state === "completed" || job.state === "failed") {
      return { jobId: job._id, state: job.state, cancelled: false };
    }
    await ctx.db.patch("downloadJobs", job._id, {
      state: "cancelled",
      updatedAt: Date.now(),
      leaseExpiresAt: undefined,
    });
    return { jobId: job._id, state: "cancelled" as const, cancelled: true };
  },
});

export const retry = mutation({
  args: { jobId: v.id("downloadJobs") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const job = await ctx.db.get("downloadJobs", args.jobId);
    if (!job || job.ownerTokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Not found");
    }
    if (job.state !== "failed") throw new Error("Only failed downloads can be retried");
    await ctx.db.patch("downloadJobs", job._id, {
      state: "queued",
      progress: 0,
      error: undefined,
      workerId: undefined,
      leaseExpiresAt: undefined,
      updatedAt: Date.now(),
    });
    return job._id;
  },
});

export const leaseNext = internalMutation({
  args: { workerId: v.string(), leaseMs: v.number() },
  handler: async (ctx, args) => {
    assertLength(args.workerId, "workerId", 120);
    const leaseMs = Math.min(Math.max(args.leaseMs, 10_000), 10 * 60_000);
    const now = Date.now();
    const queued = await ctx.db
      .query("downloadJobs")
      .withIndex("by_state_and_createdAt", (q) => q.eq("state", "queued"))
      .order("asc")
      .first();
    const expired = await ctx.db
      .query("downloadJobs")
      .withIndex("by_state_and_leaseExpiresAt", (q) =>
        q.eq("state", "processing").lt("leaseExpiresAt", now),
      )
      .order("asc")
      .first();
    const job = queued ?? expired;
    if (!job) return null;
    await ctx.db.patch("downloadJobs", job._id, {
      state: "processing",
      workerId: args.workerId,
      leaseExpiresAt: now + leaseMs,
      updatedAt: now,
    });
    return {
      _id: job._id,
      url: job.url,
      format: job.format,
      quality: job.quality,
    };
  },
});

export const updateFromWorker = internalMutation({
  args: {
    jobId: v.id("downloadJobs"),
    workerId: v.string(),
    state: jobState,
    progress: v.optional(v.number()),
    error: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    thumbnailStorageId: v.optional(v.id("_storage")),
    title: v.optional(v.string()),
    contentType: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    sizeBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertLength(args.workerId, "workerId", 120);
    assertProgress(args.progress);
    if (args.error !== undefined) assertLength(args.error, "error", 2000);
    if (args.title !== undefined) assertLength(args.title, "title", 160);

    const job = await ctx.db.get("downloadJobs", args.jobId);
    if (!job || job.workerId !== args.workerId) throw new Error("Not found");
    if (
      job.state === "cancelled" ||
      job.state === "completed" ||
      job.state === "failed"
    ) {
      return { jobId: job._id, cancelled: job.state === "cancelled" };
    }
    if (args.state === "completed" && !args.storageId) {
      throw new Error("Completed jobs require storageId");
    }

    const now = Date.now();
    let videoId = job.videoId;
    if (args.state === "completed" && args.storageId) {
      const stored = await ctx.db.system.get(args.storageId);
      if (!stored) throw new Error("Downloaded artifact not found");
      if (
        !stored.contentType?.startsWith("video/") &&
        !stored.contentType?.startsWith("audio/")
      ) {
        throw new Error("Downloaded artifact must be audio or video");
      }
      const title = args.title?.trim() || job.title || job.url;
      videoId = await ctx.db.insert("videos", {
        ownerTokenIdentifier: job.ownerTokenIdentifier,
        title,
        source: "download",
        sourceUrl: job.url,
        storageId: args.storageId,
        thumbnailStorageId: args.thumbnailStorageId,
        contentType: stored.contentType,
        durationSeconds: args.durationSeconds,
        sizeBytes: stored.size,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch("downloadJobs", job._id, {
      state: args.state,
      ...(args.progress !== undefined ? { progress: args.progress } : {}),
      ...(args.state === "completed" ? { progress: 100 } : {}),
      ...(args.error !== undefined ? { error: args.error } : {}),
      ...(args.storageId !== undefined ? { storageId: args.storageId } : {}),
      ...(args.title !== undefined ? { title: args.title } : {}),
      videoId,
      updatedAt: now,
      completedAt: args.state === "completed" ? now : undefined,
      leaseExpiresAt:
        args.state === "processing" ? now + 5 * 60_000 : undefined,
    });
    return { jobId: job._id, cancelled: false };
  },
});
