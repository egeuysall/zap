export type Command =
  | { name: "help" }
  | { name: "version" }
  | { name: "login"; apiKey?: string; endpoint?: string; json: boolean }
  | { name: "logout"; json: boolean }
  | { name: "whoami"; json: boolean }
  | { name: "config"; action: "show" | "set" | "unset" | "path"; key?: ConfigKey; value?: string; json: boolean }
  | { name: "download-submit"; url: string; format: DownloadFormat; quality?: DownloadQuality; json: boolean }
  | { name: "download-local"; url: string; format: DownloadFormat; quality: DownloadQuality; json: boolean }
  | { name: "download-status"; id: string; json: boolean }
  | { name: "download-list"; limit: number; json: boolean }
  | { name: "download-cancel"; id: string; json: boolean }
  | { name: "upload"; file: string; title?: string; json: boolean }
  | { name: "self-update"; checkOnly: boolean; json: boolean };

export type ConfigKey = "endpoint" | "apiKey" | "timeoutMs";

export type DownloadFormat = "mp4" | "mp3";
export type DownloadQuality = "best" | "1080p" | "720p" | "480p" | "audio";

export type ZapConfig = {
  endpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
};

export class CliError extends Error {
  constructor(
    message: string,
    public code = "INVALID_INPUT",
    public exitCode = 1,
  ) {
    super(message);
  }
}
