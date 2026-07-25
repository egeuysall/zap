import type { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";
import { ApiError, apiKeyHashFromRequest, authenticatedConvex, convexClient, jsonError, readJson } from "@/lib/server/convex-api";

export async function POST(request: Request) {
  try {
    const input = await readJson(request);
    const keyHash = await apiKeyHashFromRequest(request);
    const client = keyHash ? convexClient() : await authenticatedConvex(request);

    if (input.action === "upload-url") {
      return Response.json({
        uploadUrl: keyHash
          ? await client.mutation(api.storage.generateUploadUrlForApiKey, { keyHash })
          : await client.mutation(api.storage.generateUploadUrl, {}),
      });
    }

    const storageId = typeof input.storageId === "string" ? input.storageId : "";
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!storageId) throw new ApiError("storageId is required");
    if (title.length < 3) throw new ApiError("title must be at least 3 characters");

    const payload = {
      storageId: storageId as Id<"_storage">,
      title,
      contentType: typeof input.contentType === "string" ? input.contentType : undefined,
      sizeBytes: typeof input.sizeBytes === "number" ? input.sizeBytes : undefined,
    };
    const videoId = keyHash
      ? await client.mutation(api.videos.createNativeUploadForApiKey, {
          keyHash,
          ...payload,
        })
      : await client.mutation(api.videos.createNativeUpload, payload);
    return Response.json({ videoId }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
