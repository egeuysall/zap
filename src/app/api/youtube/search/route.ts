import { auth } from "@clerk/nextjs/server";

import { searchYouTube } from "@/lib/server/youtube-search";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Authentication required" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) {
    return Response.json({ error: "Search must be 2 to 100 characters" }, { status: 400 });
  }

  try {
    return Response.json(
      { results: await searchYouTube(query) },
      { headers: { "cache-control": "private, max-age=30" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "YouTube search failed" },
      { status: 502 },
    );
  }
}
