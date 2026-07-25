import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { downloadFormat, downloadQuality, jobState } from "./validators";

export default defineSchema({
  profiles: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  apiKeys: defineTable({
    ownerTokenIdentifier: v.string(),
    keyHash: v.string(),
    prefix: v.string(),
    last4: v.string(),
    name: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_ownerTokenIdentifier_and_createdAt", [
      "ownerTokenIdentifier",
      "createdAt",
    ]),

  cliAuthCodes: defineTable({
    ownerTokenIdentifier: v.string(),
    codeHash: v.string(),
    codeChallenge: v.string(),
    redirectUri: v.string(),
    state: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_codeHash", ["codeHash"]),

  videos: defineTable({
    ownerTokenIdentifier: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    source: v.union(v.literal("upload"), v.literal("download")),
    sourceUrl: v.optional(v.string()),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
    contentType: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    sizeBytes: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerTokenIdentifier_and_createdAt", [
      "ownerTokenIdentifier",
      "createdAt",
    ])
    .index("by_storageId", ["storageId"]),

  downloadJobs: defineTable({
    ownerTokenIdentifier: v.string(),
    url: v.string(),
    format: downloadFormat,
    quality: downloadQuality,
    state: jobState,
    progress: v.optional(v.number()),
    error: v.optional(v.string()),
    workerId: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    videoId: v.optional(v.id("videos")),
    storageId: v.optional(v.id("_storage")),
    title: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_ownerTokenIdentifier_and_createdAt", [
      "ownerTokenIdentifier",
      "createdAt",
    ])
    .index("by_state_and_createdAt", ["state", "createdAt"])
    .index("by_state_and_leaseExpiresAt", ["state", "leaseExpiresAt"]),
});
