import { v } from "convex/values";

export const downloadFormat = v.union(v.literal("mp4"), v.literal("mp3"));
export const downloadQuality = v.union(
  v.literal("best"),
  v.literal("1080p"),
  v.literal("720p"),
  v.literal("480p"),
  v.literal("audio"),
);
export const jobState = v.union(
  v.literal("queued"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
);
