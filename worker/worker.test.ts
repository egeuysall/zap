import { describe, expect, test } from "bun:test";
import { buildYtDlpArgs } from "./commands";
import { titleFromFilename } from "./convex-http-adapter";
import { parseMediaMetadata, runProcess } from "./index";
import { parseRedisStreamResponse } from "./redis-streams-adapter";
import { canonicalHttpUrl, normalizeOutputFormat, parseJob } from "./validators";

describe("worker validation", () => {
  test("canonicalizes public http URLs", () => {
    expect(canonicalHttpUrl("https://example.com/watch?v=1#frag")).toBe(
      "https://example.com/watch?v=1",
    );
  });

  test("rejects unsafe URLs", () => {
    expect(() => canonicalHttpUrl("file:///etc/passwd")).toThrow();
    expect(() => canonicalHttpUrl("http://localhost:3000")).toThrow();
    expect(() => canonicalHttpUrl("http://127.0.0.1/video")).toThrow();
    expect(() => canonicalHttpUrl("https://user:pass@example.com")).toThrow();
  });

  test("defaults bad formats to mp3", () => {
    expect(normalizeOutputFormat("bad")).toBe("mp3");
  });

  test("parses leased jobs", () => {
    expect(
      parseJob({ id: "j1", url: "https://example.com/a", format: "mp4" }),
    ).toMatchObject({ id: "j1", format: "mp4", kind: "video" });
  });

  test("builds shell-free yt-dlp audio args", () => {
    const args = buildYtDlpArgs({
      url: "https://example.com/a?x=$(bad)",
      outputDir: "/tmp/job",
      format: "mp3",
      filename: "My File",
    });
    expect(args).toContain("-x");
    expect(args).toContain("https://example.com/a?x=$(bad)");
    expect(args.join(" ")).not.toContain("sh -c");
  });

  test("threads requested video quality into yt-dlp", () => {
    const args = buildYtDlpArgs({
      url: "https://youtube.com/watch?v=abc",
      outputDir: "/tmp/job",
      format: "mp4",
      quality: "720p",
    });
    expect(args).toContain("bv*[height<=720]+ba/b[height<=720]");
  });

  test("caps best quality for Convex storage uploads", () => {
    const args = buildYtDlpArgs({
      url: "https://youtube.com/watch?v=abc",
      outputDir: "/tmp/job",
      format: "mp4",
      quality: "best",
    });
    expect(args).toContain("bv*[height<=720]+ba/b[height<=720]");
  });

  test("keeps probed duration for completed videos", () => {
    expect(parseMediaMetadata('{"format":{"duration":"123.45","size":"456"}}')).toEqual({
      durationSeconds: 123.45,
      sizeBytes: 456,
    });
  });

  test("turns restricted filenames into readable titles", () => {
    expect(titleFromFilename("Hypertrophic_Principles_of_Upper_Lower.mp4")).toBe(
      "Hypertrophic Principles of Upper Lower",
    );
  });

  test("serializes asynchronous process line callbacks", async () => {
    const seen: string[] = [];
    await runProcess(
      process.execPath,
      ["-e", "console.log('first'); setTimeout(() => console.log('second'), 5)"],
      5_000,
      async (line) => {
        if (line === "first") await new Promise((resolve) => setTimeout(resolve, 30));
        seen.push(line);
      },
    );
    expect(seen).toEqual(["first", "second"]);
  });

  test("parses redis stream payload entries", () => {
    expect(
      parseRedisStreamResponse([
        [
          "zap:downloads",
          [
            [
              "1-0",
              [
                "payload",
                JSON.stringify({
                  url: "https://example.com/a",
                  format: "mp3",
                  uploadUrl: "https://example.com/upload",
                }),
              ],
            ],
          ],
        ],
      ]),
    ).toEqual({
      entryId: "1-0",
      fields: {
        url: "https://example.com/a",
        format: "mp3",
        uploadUrl: "https://example.com/upload",
      },
    });
  });
});
