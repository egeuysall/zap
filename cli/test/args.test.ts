import { describe, expect, test } from "bun:test";
import { parseArgv } from "../src/args";

describe("parseArgv", () => {
  test("parses version flags without a positional command", () => {
    expect(parseArgv(["--version"])).toEqual({ name: "version" });
    expect(parseArgv(["-v"])).toEqual({ name: "version" });
  });

  test("parses direct download as remote only", () => {
    expect(parseArgv(["download", "https://example.com/watch?v=1", "--json"])).toEqual({
      name: "download-submit",
      url: "https://example.com/watch?v=1",
      format: "mp4",
      quality: "1080p",
      json: true,
    });
  });

  test("parses submit alias", () => {
    expect(parseArgv(["download", "submit", "https://example.com/watch?v=1", "--json"])).toEqual({
      name: "download-submit",
      url: "https://example.com/watch?v=1",
      format: "mp4",
      quality: "1080p",
      json: true,
    });
  });

  test("rejects invalid download format", () => {
    expect(() => parseArgv(["download", "submit", "https://example.com", "--format", "wav"])).toThrow("format must be mp4 or mp3");
  });

  test("rejects audio quality with mp4 output", () => {
    expect(() =>
      parseArgv(["download", "https://youtube.com/watch?v=abc", "--format", "mp4", "--quality", "audio"]),
    ).toThrow("audio quality requires mp3 format");
  });

  test("parses an authenticated local download", () => {
    expect(parseArgv(["local", "https://youtube.com/watch?v=abc", "--quality", "1080p"])).toEqual({
      name: "download-local",
      url: "https://youtube.com/watch?v=abc",
      format: "mp4",
      quality: "1080p",
      json: false,
    });
  });

  test("caps local video downloads at 1080p by default", () => {
    expect(parseArgv(["local", "https://youtube.com/watch?v=abc"])).toMatchObject({
      format: "mp4",
      quality: "1080p",
    });
  });
});
