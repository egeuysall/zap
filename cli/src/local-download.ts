import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { DOWNLOADS_DIR } from "./download-file";
import { CliError, type DownloadFormat, type DownloadQuality } from "./types";

export function buildLocalDownloadArgs(url: string, format: DownloadFormat, quality: DownloadQuality) {
  const base = [
    "--no-playlist",
    "--newline",
    "--continue",
    "--no-overwrites",
    "--paths",
    DOWNLOADS_DIR,
    "-o",
    "%(title).120s.%(ext)s",
  ];
  if (format === "mp3") return [...base, "-x", "--audio-format", "mp3", "--audio-quality", "0", url];
  const selector = quality === "best"
    ? "bv*+ba/b"
    : `bv*[height<=${quality.replace("p", "")}]+ba/b[height<=${quality.replace("p", "")}]`;
  return [...base, "-f", selector, "--merge-output-format", "mp4", url];
}

export async function downloadLocally(url: string, format: DownloadFormat, quality: DownloadQuality, showProgress = true) {
  await mkdir(DOWNLOADS_DIR, { recursive: true });
  const child = spawn("yt-dlp", buildLocalDownloadArgs(url, format, quality), {
    stdio: showProgress ? "inherit" : ["inherit", "ignore", "inherit"],
  });
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      throw new CliError("local downloads require yt-dlp and ffmpeg. Install them with `brew install yt-dlp ffmpeg`");
    }
    throw error;
  });
  if (exitCode !== 0) throw new CliError(`yt-dlp failed with exit code ${exitCode}`, "DOWNLOAD_FAILED", 2);
  return DOWNLOADS_DIR;
}
