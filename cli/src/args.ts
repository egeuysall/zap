import { CliError, type Command, type ConfigKey, type DownloadFormat, type DownloadQuality } from "./types";

type Parsed = {
  positionals: string[];
  options: Record<string, string | boolean>;
};

const CONFIG_KEYS = new Set<ConfigKey>(["endpoint", "apiKey", "timeoutMs"]);
const FORMATS = new Set<DownloadFormat>(["mp4", "mp3"]);
const QUALITIES = new Set<DownloadQuality>(["best", "1080p", "720p", "480p", "audio"]);

export function parseArgv(argv: string[]): Command {
  const parsed = parseArgs(argv);
  const [first, second, third] = parsed.positionals;
  const json = flag(parsed, "json") || flag(parsed, "j");

  if (first === "version" || flag(parsed, "version") || flag(parsed, "v")) return { name: "version" };
  if (!first || first === "help" || flag(parsed, "help") || flag(parsed, "h")) return { name: "help" };

  if (first === "login") {
    const apiKey = stringOpt(parsed, "token") ?? stringOpt(parsed, "api-key") ?? second;
    return { name: "login", apiKey, endpoint: stringOpt(parsed, "endpoint") ?? undefined, json };
  }

  if (first === "logout") return { name: "logout", json };
  if (first === "whoami") return { name: "whoami", json };

  if (first === "config") {
    const action = second ?? "show";
    if (action === "path") return { name: "config", action: "path", json };
    if (action === "show") return { name: "config", action: "show", json };
    if (action !== "set" && action !== "unset") throw new CliError(`unknown config action: ${action}`);
    const key = parseConfigKey(third);
    return { name: "config", action, key, value: parsed.positionals[3], json };
  }

  if (first === "upload") {
    const file = second;
    if (!file) throw new CliError("missing file. run `zap upload ./video.mp4`");
    return { name: "upload", file, title: stringOpt(parsed, "title") ?? undefined, json };
  }

  if (first === "download" || first === "dl") {
    return parseDownload(parsed, first, json);
  }

  if (first === "local") {
    if (!second) throw new CliError("missing url. run `zap local <url>`");
    const format = parseFormat(stringOpt(parsed, "format") ?? "mp4");
    const quality = parseQuality(stringOpt(parsed, "quality") ?? defaultQuality(format));
    if (format === "mp4" && quality === "audio") throw new CliError("audio quality requires mp3 format");
    return { name: "download-local", url: second, format, quality, json };
  }

  if (first === "self-update") return { name: "self-update", checkOnly: flag(parsed, "check") || flag(parsed, "check-only"), json };

  throw new CliError(`unknown command: ${first}`, "COMMAND_INVALID");
}

function parseDownload(parsed: Parsed, root: string, json: boolean): Command {
  const sub = parsed.positionals[1] ?? "submit";

  if (parsed.positionals[1] && !["submit", "run", "status", "list", "ls", "cancel"].includes(parsed.positionals[1])) {
    const format = parseFormat(stringOpt(parsed, "format") ?? "mp4");
    const quality = optionalQuality(parsed) ?? defaultQuality(format);
    if (format === "mp4" && quality === "audio") throw new CliError("audio quality requires mp3 format");
    return {
      name: "download-submit",
      url: parsed.positionals[1],
      format,
      quality,
      json,
    };
  }

  if (sub === "submit" || sub === "run") {
    const url = parsed.positionals[2];
    if (!url) throw new CliError(`missing url. run \`zap ${root} submit <url>\``);
    const format = parseFormat(stringOpt(parsed, "format") ?? "mp4");
    const quality = optionalQuality(parsed) ?? defaultQuality(format);
    if (format === "mp4" && quality === "audio") throw new CliError("audio quality requires mp3 format");
    return {
      name: "download-submit",
      url,
      format,
      quality,
      json,
    };
  }

  if (sub === "status") {
    const id = parsed.positionals[2];
    if (!id) throw new CliError("missing job id. run `zap download status <jobId>`");
    return { name: "download-status", id, json };
  }

  if (sub === "list" || sub === "ls") {
    const rawLimit = stringOpt(parsed, "limit") ?? "20";
    const limit = Number.parseInt(rawLimit, 10);
    if (!Number.isFinite(limit) || limit < 1 || limit > 100) throw new CliError("limit must be 1-100");
    return { name: "download-list", limit, json };
  }

  if (sub === "cancel") {
    const id = parsed.positionals[2];
    if (!id) throw new CliError("missing job id. run `zap download cancel <jobId>`");
    return { name: "download-cancel", id, json };
  }

  throw new CliError(`unknown download command: ${sub}`, "COMMAND_INVALID");
}

function parseArgs(argv: string[]): Parsed {
  const positionals: string[] = [];
  const options: Parsed["options"] = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (token.startsWith("--")) {
      const [key, inline] = token.slice(2).split("=", 2);
      if (!key) continue;
      const next = argv[index + 1];
      if (inline !== undefined) options[key] = inline;
      else if (next && !next.startsWith("-")) {
        options[key] = next;
        index += 1;
      } else options[key] = true;
      continue;
    }
    if (token === "-o") {
      const next = argv[index + 1];
      if (!next) throw new CliError("missing value for -o");
      options.o = next;
      index += 1;
      continue;
    }
    if (token.startsWith("-") && token.length > 1) {
      for (const flagName of token.slice(1)) options[flagName] = true;
      continue;
    }
    positionals.push(token);
  }

  return { positionals, options };
}

function flag(parsed: Parsed, name: string) {
  return parsed.options[name] === true;
}

function stringOpt(parsed: Parsed, name: string) {
  const value = parsed.options[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseFormat(value: string): DownloadFormat {
  if (FORMATS.has(value as DownloadFormat)) return value as DownloadFormat;
  throw new CliError("format must be mp4 or mp3");
}

function parseQuality(value: string): DownloadQuality {
  if (QUALITIES.has(value as DownloadQuality)) return value as DownloadQuality;
  throw new CliError("quality must be best, 1080p, 720p, 480p, or audio");
}

function optionalQuality(parsed: Parsed) {
  const value = stringOpt(parsed, "quality");
  return value ? parseQuality(value) : undefined;
}

function defaultQuality(format: DownloadFormat): DownloadQuality {
  return format === "mp3" ? "audio" : "1080p";
}

function parseConfigKey(value: string | undefined): ConfigKey {
  if (value && CONFIG_KEYS.has(value as ConfigKey)) return value as ConfigKey;
  throw new CliError(`config key must be one of: ${Array.from(CONFIG_KEYS).join(", ")}`);
}
