import { api } from "../../../../convex/_generated/api";
import { ApiError, apiKeyHashFromRequest, authenticatedConvex, convexClient, jsonError, readJson } from "@/lib/server/convex-api";

const formats = new Set(["mp4", "mp3"]);
const qualities = new Set(["best", "1080p", "720p", "480p", "audio"]);

export async function POST(request: Request) {
  try {
    const input = await readJson(request);
    const url = typeof input.url === "string" ? input.url : "";
    const format = typeof input.format === "string" ? input.format : "mp4";
    const quality = typeof input.quality === "string" ? input.quality : "best";
    if (!url) throw new ApiError("url is required");
    if (!formats.has(format)) throw new ApiError("format must be mp4 or mp3");
    if (!qualities.has(quality)) throw new ApiError("quality is invalid");
    if (format === "mp4" && quality === "audio") {
      throw new ApiError("audio quality requires mp3 format");
    }

    const keyHash = await apiKeyHashFromRequest(request);
    const client = keyHash ? convexClient() : await authenticatedConvex(request);
    const jobId = keyHash
      ? await client.mutation(api.downloads.createJobForApiKey, {
          keyHash,
          url,
          format: format as "mp4" | "mp3",
          quality: quality as "best" | "1080p" | "720p" | "480p" | "audio",
        })
      : await client.mutation(api.downloads.createJob, {
          url,
          format: format as "mp4" | "mp3",
          quality: quality as "best" | "1080p" | "720p" | "480p" | "audio",
        });
    return Response.json({ jobId }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  try {
    const rawLimit = new URL(request.url).searchParams.get("limit") ?? "20";
    const limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ApiError("limit must be an integer from 1 to 100");
    }
    const keyHash = await apiKeyHashFromRequest(request);
    const client = keyHash ? convexClient() : await authenticatedConvex(request);
    return Response.json(
      keyHash
        ? await client.query(api.downloads.listForApiKey, { keyHash, limit })
        : await client.query(api.downloads.listMine, { limit }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
