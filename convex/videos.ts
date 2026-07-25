import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  assertDownloadUrl,
  assertLength,
  getOrCreateProfile,
  ownerFromApiKeyHash,
  requireIdentity,
} from "./model";

export const listMine = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_ownerTokenIdentifier_and_createdAt", (q) =>
        q.eq("ownerTokenIdentifier", identity.tokenIdentifier),
      )
      .order("desc")
      .take(limit);

    return await Promise.all(
      videos.map(async (video) => ({
        ...video,
        url: await ctx.storage.getUrl(video.storageId),
        thumbnailUrl: video.thumbnailStorageId
          ? await ctx.storage.getUrl(video.thumbnailStorageId)
          : null,
      })),
    );
  },
});

export const getMine = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const video = await ctx.db.get("videos", args.videoId);
    if (!video || video.ownerTokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Not found");
    }
    return {
      ...video,
      url: await ctx.storage.getUrl(video.storageId),
      thumbnailUrl: video.thumbnailStorageId
        ? await ctx.storage.getUrl(video.thumbnailStorageId)
        : null,
    };
  },
});

export const createNativeUpload = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
    contentType: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    sizeBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getOrCreateProfile(ctx);
    const identity = await requireIdentity(ctx);
    assertLength(args.title, "title", 160);
    if (args.description !== undefined) {
      assertLength(args.description, "description", 2000);
    }
    if (args.durationSeconds !== undefined && args.durationSeconds < 0) {
      throw new Error("Duration must be positive");
    }
    if (args.sizeBytes !== undefined && args.sizeBytes < 0) {
      throw new Error("Size must be positive");
    }
    const stored = await ctx.db.system.get(args.storageId);
    if (!stored) throw new Error("Uploaded file not found");
    if (!stored.contentType?.startsWith("video/")) {
      throw new Error("Only video uploads are supported");
    }
    if (args.thumbnailStorageId) {
      const thumbnail = await ctx.db.system.get(args.thumbnailStorageId);
      if (!thumbnail?.contentType?.startsWith("image/")) {
        throw new Error("Thumbnail must be an image");
      }
    }
    const now = Date.now();
    return await ctx.db.insert("videos", {
      ownerTokenIdentifier: identity.tokenIdentifier,
      title: args.title.trim(),
      description: args.description?.trim(),
      source: "upload",
      storageId: args.storageId,
      thumbnailStorageId: args.thumbnailStorageId,
      contentType: stored.contentType,
      durationSeconds: args.durationSeconds,
      sizeBytes: stored.size,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createNativeUploadForApiKey = mutation({
  args: {
    keyHash: v.string(),
    title: v.string(),
    storageId: v.id("_storage"),
    contentType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ownerTokenIdentifier = await ownerFromApiKeyHash(ctx, args.keyHash);
    assertLength(args.title, "title", 160);
    const stored = await ctx.db.system.get(args.storageId);
    if (!stored) throw new Error("Uploaded file not found");
    if (!stored.contentType?.startsWith("video/")) {
      throw new Error("Only video uploads are supported");
    }
    const now = Date.now();
    return await ctx.db.insert("videos", {
      ownerTokenIdentifier,
      title: args.title.trim(),
      source: "upload",
      storageId: args.storageId,
      contentType: stored.contentType,
      sizeBytes: stored.size,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const video = await ctx.db.get("videos", args.videoId);
    if (!video || video.ownerTokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Not found");
    }
    await ctx.storage.delete(video.storageId);
    if (video.thumbnailStorageId) await ctx.storage.delete(video.thumbnailStorageId);
    await ctx.db.delete("videos", video._id);
  },
});

export const setDuration = mutation({
  args: { videoId: v.id("videos"), durationSeconds: v.number() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const video = await ctx.db.get("videos", args.videoId);
    if (!video || video.ownerTokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Not found");
    }
    if (!Number.isFinite(args.durationSeconds) || args.durationSeconds <= 0) {
      throw new Error("Duration must be positive");
    }
    if (!video.durationSeconds) {
      await ctx.db.patch("videos", video._id, {
        durationSeconds: args.durationSeconds,
        updatedAt: Date.now(),
      });
    }
  },
});

export function validateSourceUrl(url: string | undefined) {
  if (url !== undefined) assertDownloadUrl(url);
}
