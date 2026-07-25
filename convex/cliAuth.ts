import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireIdentity } from "./model";

const PARAM = /^[A-Za-z0-9_-]{32,256}$/;

function assertParam(value: string, name: string) {
  if (!PARAM.test(value)) throw new Error(`Invalid ${name}`);
}

export const createCode = mutation({
  args: {
    codeHash: v.string(),
    codeChallenge: v.string(),
    redirectUri: v.string(),
    state: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    assertParam(args.codeHash, "code");
    assertParam(args.codeChallenge, "code challenge");
    assertParam(args.state, "state");
    if (args.expiresAt <= Date.now() || args.expiresAt > Date.now() + 6 * 60_000) {
      throw new Error("Invalid expiration");
    }
    const existing = await ctx.db
      .query("cliAuthCodes")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", args.codeHash))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("cliAuthCodes", {
      ownerTokenIdentifier: identity.tokenIdentifier,
      ...args,
    });
  },
});

export const consumeCodeAndCreateApiKey = mutation({
  args: {
    codeHash: v.string(),
    codeChallenge: v.string(),
    redirectUri: v.string(),
    keyHash: v.string(),
    prefix: v.string(),
    last4: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const code = await ctx.db
      .query("cliAuthCodes")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", args.codeHash))
      .unique();
    const now = Date.now();
    if (
      !code ||
      code.usedAt !== undefined ||
      code.expiresAt < now ||
      code.redirectUri !== args.redirectUri ||
      code.codeChallenge !== args.codeChallenge
    ) {
      return null;
    }
    await ctx.db.patch(code._id, { usedAt: now });
    const keyId = await ctx.db.insert("apiKeys", {
      ownerTokenIdentifier: code.ownerTokenIdentifier,
      keyHash: args.keyHash,
      prefix: args.prefix,
      last4: args.last4,
      name: args.name,
      createdAt: now,
    });
    return { keyId };
  },
});
