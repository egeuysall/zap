import { mutation, query } from "./_generated/server";
import { getOrCreateProfile, requireIdentity } from "./model";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    return await ctx.db
      .query("profiles")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});

export const sync = mutation({
  args: {},
  handler: async (ctx) => {
    const profileId = await getOrCreateProfile(ctx);
    return await ctx.db.get("profiles", profileId);
  },
});
