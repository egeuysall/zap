import { describe, expect, test } from "bun:test";

import { parseYouTubeSearchHtml } from "../src/lib/server/youtube-search";

describe("YouTube search parser", () => {
  test("returns bounded video metadata", () => {
    const renderer = {
      videoRenderer: {
        videoId: "abc123def45",
        title: { runs: [{ text: "Test video" }] },
        ownerText: { runs: [{ text: "Test channel" }] },
        lengthText: { simpleText: "2:03" },
        thumbnail: { thumbnails: [{ url: "https://i.ytimg.com/vi/abc123def45/hq720.jpg" }] },
        channelThumbnailSupportedRenderers: {
          channelThumbnailWithLinkRenderer: {
            thumbnail: { thumbnails: [{ url: "https://yt3.ggpht.com/avatar" }] },
          },
        },
        ownerBadges: [{ metadataBadgeRenderer: { style: "BADGE_STYLE_TYPE_VERIFIED" } }],
      },
    };
    const ignored = {
      contents: {
        shelfRenderer: {
          videoRenderer: {
            videoId: "ignored12345",
            title: { simpleText: "Ignored shelf video" },
          },
        },
      },
    };
    const data = {
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            sectionListRenderer: {
              contents: [{
                itemSectionRenderer: { contents: [renderer, renderer] },
              }],
            },
          },
        },
        ignored,
      },
    };
    const html = `<script>var ytInitialData = ${JSON.stringify(data)};</script>`;

    expect(parseYouTubeSearchHtml(html)).toEqual([
      {
        id: "abc123def45",
        title: "Test video",
        channel: "Test channel",
        duration: "2:03",
        views: null,
        published: null,
        thumbnail: "https://i.ytimg.com/vi/abc123def45/hq720.jpg",
        avatar: "https://yt3.ggpht.com/avatar",
        verified: true,
        url: "https://www.youtube.com/watch?v=abc123def45",
      },
    ]);
  });
});
