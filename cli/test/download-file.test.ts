import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { DOWNLOADS_DIR, nextDownloadPath, safeName } from "../src/download-file";

describe("download destination", () => {
  test("uses ~/Downloads", () => {
    expect(DOWNLOADS_DIR.endsWith("/Downloads")).toBe(true);
  });

  test("sanitizes names and adds collision suffix", async () => {
    const dir = join(tmpdir(), `zap-test-${Date.now()}`);
    await mkdir(dir);
    await writeFile(join(dir, "bad-name.mp4"), "");
    expect(safeName(" bad/name ")).toBe("bad-name");
    expect(await nextDownloadPath("bad/name", "mp4", dir)).toBe(join(dir, "bad-name-2.mp4"));
  });
});
