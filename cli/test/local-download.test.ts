import { expect, test } from "bun:test";
import { buildLocalDownloadArgs } from "../src/local-download";

test("builds a shell-free local download into ~/Downloads", () => {
  const url = "https://youtube.com/watch?v=abc&list=ignored";
  const args = buildLocalDownloadArgs(url, "mp4", "1080p");
  expect(args.at(-1)).toBe(url);
  expect(args).toContain("--no-playlist");
  expect(args).toContain("bv*[height<=1080]+ba/b[height<=1080]");
  expect(args.some((arg) => arg.includes("~/"))).toBe(false);
});

test("caps default-quality video selection at 1080p with lower fallback", () => {
  const args = buildLocalDownloadArgs("https://youtube.com/watch?v=abc", "mp4", "1080p");
  expect(args).toContain("bv*[height<=1080]+ba/b[height<=1080]");
});
