import { api } from "../../../../convex/_generated/api";
import {
  ApiError,
  apiKeyHashFromRequest,
  convexClient,
  jsonError,
} from "@/lib/server/convex-api";

export async function GET(request: Request) {
  try {
    const keyHash = await apiKeyHashFromRequest(request);
    if (!keyHash) throw new ApiError("Authentication required", 401);
    return Response.json(await convexClient().query(api.apiKeys.verify, { keyHash }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const keyHash = await apiKeyHashFromRequest(request);
    if (!keyHash) throw new ApiError("Authentication required", 401);
    await convexClient().mutation(api.apiKeys.revoke, { keyHash });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
