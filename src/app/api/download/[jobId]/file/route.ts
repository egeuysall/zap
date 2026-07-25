import type { Id } from "../../../../../../convex/_generated/dataModel";
import { api } from "../../../../../../convex/_generated/api";
import {
  apiKeyHashFromRequest,
  authenticatedConvex,
  convexClient,
  jsonError,
} from "@/lib/server/convex-api";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { jobId } = await context.params;
    const keyHash = await apiKeyHashFromRequest(request);
    const client = keyHash ? convexClient() : await authenticatedConvex(request);
    const job = keyHash
      ? await client.query(api.downloads.getForApiKey, {
          keyHash,
          jobId: jobId as Id<"downloadJobs">,
        })
      : await client.query(api.downloads.getMine, {
          jobId: jobId as Id<"downloadJobs">,
        });
    if (!job.videoUrl || job.state !== "completed") {
      return Response.json({ error: "Download is not ready" }, { status: 409 });
    }

    const artifact = await fetch(job.videoUrl);
    if (!artifact.ok || !artifact.body) {
      return Response.json({ error: "Stored file is unavailable" }, { status: 502 });
    }
    const filename = `${safeFilename(job.title || "zap-download")}.${job.format}`;
    const headers = new Headers({
      "content-type": artifact.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "private, no-store",
    });
    const length = artifact.headers.get("content-length");
    if (length) headers.set("content-length", length);
    return new Response(artifact.body, {
      headers,
    });
  } catch (error) {
    return jsonError(error);
  }
}

function safeFilename(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "zap-download";
}
