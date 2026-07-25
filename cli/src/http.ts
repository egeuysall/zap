import { CliError, type ZapConfig } from "./types";
import { resolveApiKey, resolveEndpoint } from "./config";

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  form?: FormData;
  config: ZapConfig;
};

export async function requestJson(options: RequestOptions) {
  const endpoint = new URL(options.path, validateEndpoint(resolveEndpoint(options.config)));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.config.timeoutMs ?? 30000);
  const apiKey = resolveApiKey(options.config);

  try {
    const response = await fetch(endpoint, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: options.form ?? (options.body ? JSON.stringify(options.body) : undefined),
      signal: controller.signal,
    });
    const text = await response.text();
    const data = text ? safeParse(text) : {};
    if (!response.ok) {
      const message = typeof data === "object" && data && "error" in data ? String(data.error) : `request failed with ${response.status}`;
      throw new CliError(message, "HTTP_ERROR", response.status >= 500 ? 2 : 1);
    }
    return data;
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(error instanceof Error ? error.message : String(error), "NETWORK_ERROR", 2);
  } finally {
    clearTimeout(timeout);
  }
}

export function validateContentUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CliError("url must be absolute");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new CliError("url must use http or https");
  if (url.username || url.password) throw new CliError("url must not contain credentials");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    host !== "youtu.be" &&
    host !== "youtube.com" &&
    !host.endsWith(".youtube.com") &&
    host !== "youtube-nocookie.com" &&
    !host.endsWith(".youtube-nocookie.com")
  ) {
    throw new CliError("url must be a YouTube video URL");
  }
  return url.toString();
}

function validateEndpoint(raw: string) {
  const url = new URL(raw);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    throw new CliError("endpoint must use https, except localhost");
  }
  return url;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}
