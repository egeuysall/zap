export type YouTubeSearchResult = {
  id: string;
  title: string;
  channel: string;
  duration: string | null;
  views: string | null;
  published: string | null;
  thumbnail: string | null;
  avatar: string | null;
  verified: boolean;
  url: string;
};

const initialDataMarker = "var ytInitialData = ";
const maxResponseBytes = 3_000_000;

export async function searchYouTube(query: string) {
  // ponytail: HTML search avoids requiring an API key; switch to search.list if YouTube markup becomes unstable.
  const url = new URL("https://www.youtube.com/results");
  url.searchParams.set("search_query", query);
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 (compatible; ZapSearch/1.0)",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`YouTube search failed (${response.status})`);
  const html = await response.text();
  if (html.length > maxResponseBytes) throw new Error("YouTube search response was too large");
  return parseYouTubeSearchHtml(html);
}

export function parseYouTubeSearchHtml(html: string) {
  const start = html.indexOf(initialDataMarker);
  if (start < 0) throw new Error("YouTube search results were unavailable");
  const jsonStart = start + initialDataMarker.length;
  const jsonEnd = html.indexOf(";</script>", jsonStart);
  if (jsonEnd < 0) throw new Error("YouTube search results were incomplete");

  const root = JSON.parse(html.slice(jsonStart, jsonEnd)) as unknown;
  const sections = readPath(root, [
    "contents",
    "twoColumnSearchResultsRenderer",
    "primaryContents",
    "sectionListRenderer",
    "contents",
  ]);
  const results: YouTubeSearchResult[] = [];
  const seen = new Set<string>();

  if (!Array.isArray(sections)) return results;
  for (const section of sections) {
    const items = readPath(section, ["itemSectionRenderer", "contents"]);
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!isRecord(item)) continue;
      const renderer = item.videoRenderer;
      if (!isRecord(renderer)) continue;
      const result = mapVideoRenderer(renderer);
      if (result && !seen.has(result.id)) {
        seen.add(result.id);
        results.push(result);
      }
      if (results.length >= 18) return results;
    }
  }

  return results;
}

function mapVideoRenderer(renderer: Record<string, unknown>): YouTubeSearchResult | null {
  const id = typeof renderer.videoId === "string" ? renderer.videoId : "";
  const title = readText(renderer.title);
  if (!/^[\w-]{6,20}$/.test(id) || !title) return null;

  return {
    id,
    title,
    channel: readText(renderer.ownerText) || "YouTube",
    duration: readText(renderer.lengthText) || null,
    views: readText(renderer.viewCountText) || null,
    published: readText(renderer.publishedTimeText) || null,
    thumbnail: readImage(renderer.thumbnail, ["ytimg.com"]),
    avatar: readImage(
      readPath(renderer, [
        "channelThumbnailSupportedRenderers",
        "channelThumbnailWithLinkRenderer",
        "thumbnail",
      ]),
      ["ggpht.com", "ytimg.com"],
    ),
    verified: hasVerifiedBadge(renderer.ownerBadges),
    url: `https://www.youtube.com/watch?v=${id}`,
  };
}

function readText(value: unknown) {
  if (!isRecord(value)) return "";
  if (typeof value.simpleText === "string") return value.simpleText;
  if (!Array.isArray(value.runs)) return "";
  return value.runs
    .map((run) => isRecord(run) && typeof run.text === "string" ? run.text : "")
    .join("");
}

function readImage(value: unknown, domains: string[]) {
  if (!isRecord(value) || !Array.isArray(value.thumbnails)) return null;
  for (const thumbnail of value.thumbnails.toReversed()) {
    if (!isRecord(thumbnail) || typeof thumbnail.url !== "string") continue;
    try {
      const url = new URL(thumbnail.url);
      if (url.protocol === "https:" && domains.some((domain) =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      )) {
        return url.toString();
      }
    } catch {
      continue;
    }
  }
  return null;
}

function hasVerifiedBadge(value: unknown) {
  if (!Array.isArray(value)) return false;
  return value.some((badge) => {
    const style = readPath(badge, ["metadataBadgeRenderer", "style"]);
    return style === "BADGE_STYLE_TYPE_VERIFIED" ||
      style === "BADGE_STYLE_TYPE_VERIFIED_ARTIST";
  });
}

function readPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
