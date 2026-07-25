import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CliError, type ConfigKey, type ZapConfig } from "./types";

const CONFIG_DIR = path.join(os.homedir(), ".config", "zap");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export function getConfigPath() {
  return CONFIG_PATH;
}

export async function loadConfig(): Promise<ZapConfig> {
  try {
    const parsed = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? normalizeConfig(parsed as ZapConfig) : {};
  } catch {
    return {};
  }
}

export async function saveConfig(config: ZapConfig) {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(normalizeConfig(config), null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(CONFIG_PATH, 0o600);
}

export async function setConfig(key: ConfigKey, rawValue: string | undefined) {
  if (!rawValue) throw new CliError(`missing value for ${key}`);
  const config = await loadConfig();
  const value = key === "timeoutMs" ? parseTimeout(rawValue) : rawValue.trim();
  if (key === "endpoint") validateEndpoint(value);
  await saveConfig({ ...config, [key]: value });
  return loadConfig();
}

export async function unsetConfig(key: ConfigKey) {
  const config = await loadConfig();
  delete config[key];
  await saveConfig(config);
  return loadConfig();
}

export function resolveApiKey(config: ZapConfig) {
  return (process.env.ZAP_API_KEY ?? config.apiKey ?? "").trim();
}

export function resolveEndpoint(config: ZapConfig) {
  return process.env.ZAP_ENDPOINT ?? config.endpoint ?? "https://zap.egeuysal.com";
}

export function maskConfig(config: ZapConfig): ZapConfig {
  return { ...config, apiKey: config.apiKey ? "***" : undefined };
}

function normalizeConfig(config: ZapConfig): ZapConfig {
  const next: ZapConfig = {};
  if (typeof config.endpoint === "string" && config.endpoint.trim()) next.endpoint = config.endpoint.trim();
  if (typeof config.apiKey === "string" && config.apiKey.trim()) next.apiKey = config.apiKey.trim();
  if (typeof config.timeoutMs === "number" && Number.isFinite(config.timeoutMs) && config.timeoutMs > 0) next.timeoutMs = Math.floor(config.timeoutMs);
  return next;
}

function parseTimeout(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1000 || parsed > 120000) {
    throw new CliError("timeoutMs must be 1000-120000");
  }
  return parsed;
}

function validateEndpoint(value: string | number) {
  let url: URL;
  try {
    url = new URL(String(value));
  } catch {
    throw new CliError("endpoint must be an absolute URL");
  }
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    throw new CliError("endpoint must use https, except localhost");
  }
}
