import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrCreateProfile, ownerFromApiKeyHash } from "./model";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getOrCreateProfile(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const generateUploadUrlForApiKey = mutation({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    await ownerFromApiKeyHash(ctx, args.keyHash);
    return await ctx.storage.generateUploadUrl();
  },
});
