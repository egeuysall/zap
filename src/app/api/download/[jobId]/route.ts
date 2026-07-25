import type { Id } from "../../../../../convex/_generated/dataModel";
import { api } from "../../../../../convex/_generated/api";
import { apiKeyHashFromRequest, authenticatedConvex, convexClient, jsonError } from "@/lib/server/convex-api";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { jobId } = await context.params;
    const keyHash = await apiKeyHashFromRequest(request);
    const client = keyHash ? convexClient() : await authenticatedConvex(request);
    return Response.json(
      keyHash
        ? await client.query(api.downloads.getForApiKey, {
            keyHash,
            jobId: jobId as Id<"downloadJobs">,
          })
        : await client.query(api.downloads.getMine, {
            jobId: jobId as Id<"downloadJobs">,
          }),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { jobId } = await context.params;
    const keyHash = await apiKeyHashFromRequest(request);
    const client = keyHash ? convexClient() : await authenticatedConvex(request);
    const result = keyHash
      ? await client.mutation(api.downloads.cancelForApiKey, {
          keyHash,
          jobId: jobId as Id<"downloadJobs">,
        })
      : await client.mutation(api.downloads.cancel, {
          jobId: jobId as Id<"downloadJobs">,
        });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
