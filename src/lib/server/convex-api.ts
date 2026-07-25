import "server-only";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { hashApiKey, isZapApiKey, readApiKey } from "./api-keys";

export async function authenticatedConvex(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearer ?? (await (await auth()).getToken({ template: "convex" }));
  if (!token) throw new ApiError("Authentication required", 401);

  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new ApiError("Convex is not configured", 503);

  const client = new ConvexHttpClient(url);
  client.setAuth(token);
  return client;
}

export function convexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new ApiError("Convex is not configured", 503);
  return new ConvexHttpClient(url);
}

export async function apiKeyHashFromRequest(request: Request) {
  const key = readApiKey(request);
  return isZapApiKey(key) ? hashApiKey(key!) : null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Request failed";
  const status = /Unauthenticated|Not authenticated|Authentication required/i.test(message)
    ? 401
    : /Not found/i.test(message)
      ? 404
      : 400;
  return Response.json({ error: message }, { status });
}

export async function readJson(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new ApiError("Expected a JSON request body");
  }
}
