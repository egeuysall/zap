import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ownerFromApiKeyHash } from "./model";

export const verify = query({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    await ownerFromApiKeyHash(ctx, args.keyHash);
    return { authenticated: true, authType: "clerk-browser" };
  },
});

export const revoke = mutation({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    await ownerFromApiKeyHash(ctx, args.keyHash);
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", args.keyHash))
      .unique();
    if (key) await ctx.db.delete(key._id);
    return null;
  },
});
