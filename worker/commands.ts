import path from "node:path";
import type { DownloadQuality, OutputFormat } from "./types";
import { outputKindFor, safeFilename } from "./validators";

export function contentTypeFor(format: OutputFormat): string {
  switch (format) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
  }
}

export function buildYtDlpArgs(input: {
  url: string;
  outputDir: string;
  format: OutputFormat;
  quality?: DownloadQuality;
  filename?: string;
}): string[] {
  const output = input.filename
    ? path.join(input.outputDir, `${safeFilename(input.filename)}.%(ext)s`)
    : path.join(input.outputDir, "%(title).120s.%(ext)s");
  const base = [
    "--no-playlist",
    "--restrict-filenames",
    "--newline",
    "--no-call-home",
    "--force-overwrites",
    "--paths",
    input.outputDir,
    "-o",
    output,
  ];

  if (outputKindFor(input.format) === "audio") {
    return [
      ...base,
      "-x",
      "--audio-format",
      input.format,
      "--audio-quality",
      "0",
      input.url,
    ];
  }

  return [
    ...base,
    "-f",
    videoSelector(input.quality ?? "best"),
    "--merge-output-format",
    input.format,
    input.url,
  ];
}

function videoSelector(quality: DownloadQuality) {
  if (quality === "audio") return "ba/b";
  if (quality === "best") return "bv*[height<=720]+ba/b[height<=720]";
  const height = quality.replace("p", "");
  return `bv*[height<=${height}]+ba/b[height<=${height}]`;
}

export function buildFfprobeArgs(file: string): string[] {
  return [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size",
    "-of",
    "json",
    file,
  ];
}
