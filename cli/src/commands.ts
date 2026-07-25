import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { getConfigPath, loadConfig, maskConfig, resolveApiKey, resolveEndpoint, saveConfig, setConfig, unsetConfig } from "./config";
import { runBrowserLogin } from "./browser-auth";
import { DOWNLOADS_DIR, saveRemoteFile } from "./download-file";
import { requestJson, validateContentUrl } from "./http";
import { downloadLocally } from "./local-download";
import { printJson, printOk, printTable } from "./output";
import { selfUpdate } from "./self-update";
import { CliError, type Command } from "./types";
import { VERSION } from "./version";

export async function runCommand(command: Command) {
  const config = await loadConfig();

  if (command.name === "login") {
    const endpoint = command.endpoint ?? config.endpoint ?? process.env.ZAP_ENDPOINT;
    const apiKey = command.apiKey ?? (await runBrowserLogin(resolveEndpoint({ ...config, endpoint }))).apiKey;
    await saveConfig({ ...config, apiKey, endpoint });
    await requestJson({ path: "/api/auth", config: { ...config, apiKey, endpoint } });
    if (command.json) {
      printJson({ authenticated: true, endpoint: resolveEndpoint({ ...config, endpoint }) });
      return;
    }
    printOk(`login saved. Downloads will save to ${DOWNLOADS_DIR}`);
    return;
  }

  if (command.name === "logout") {
    await requestJson({ method: "DELETE", path: "/api/auth", config }).catch(() => undefined);
    await saveConfig({ ...config, apiKey: undefined });
    if (command.json) {
      printJson({ authenticated: false });
      return;
    }
    printOk("logged out");
    return;
  }

  if (command.name === "whoami") {
    const data = await requestJson({ path: "/api/auth", config }).catch(() => ({ authenticated: false, endpoint: resolveEndpoint(config) })) as Record<string, unknown>;
    if (command.json) printJson(data);
    else printTable("zap auth", [data]);
    return;
  }

  if (command.name === "config") {
    if (command.action === "path") {
      process.stdout.write(`${getConfigPath()}\n`);
      return;
    }
    if (command.action === "set") {
      printJson(maskConfig(await setConfig(command.key!, command.value)));
      return;
    }
    if (command.action === "unset") {
      printJson(maskConfig(await unsetConfig(command.key!)));
      return;
    }
    if (command.json) printJson(maskConfig(config));
    else printTable("zap config", Object.entries(maskConfig(config)).map(([key, value]) => ({ key, value })));
    return;
  }

  if (command.name === "download-submit") {
    const submitted = await requestJson({
      method: "POST",
      path: "/api/download",
      body: { url: validateContentUrl(command.url), format: command.format, quality: command.quality },
      config,
    }) as { jobId?: string };
    if (!submitted.jobId) throw new CliError("server did not return a job id", "DOWNLOAD_ERROR", 2);
    if (!command.json) printOk(`remote download queued: ${submitted.jobId}. Saving to ${DOWNLOADS_DIR} when complete.`);
    const done = await waitForDownload(config, submitted.jobId);
    const output = await saveRemoteFile(done.videoUrl, done.title || submitted.jobId, done.format ?? command.format);
    if (command.json) printJson({ ...done, output });
    else printOk(`download saved to ${output}`);
    return;
  }

  if (command.name === "download-local") {
    if (!resolveApiKey(config)) throw new CliError("authentication required. Run `zap login` first.", "AUTH_REQUIRED");
    const outputDir = await downloadLocally(validateContentUrl(command.url), command.format, command.quality, !command.json);
    if (command.json) printJson({ outputDir, format: command.format, quality: command.quality });
    else printOk(`download saved to ${outputDir}`);
    return;
  }

  if (command.name === "download-status") {
    const data = await requestJson({ path: `/api/download/${encodeURIComponent(command.id)}`, config });
    if (command.json) printJson(data);
    else printTable("download status", [data as Record<string, unknown>]);
    return;
  }

  if (command.name === "download-list") {
    const data = await requestJson({ path: `/api/download?limit=${command.limit}`, config });
    if (command.json) printJson(data);
    else printTable("downloads", Array.isArray(data) ? data as Array<Record<string, unknown>> : [data as Record<string, unknown>]);
    return;
  }

  if (command.name === "download-cancel") {
    const data = await requestJson({ method: "DELETE", path: `/api/download/${encodeURIComponent(command.id)}`, config }) as {
      cancelled?: boolean;
      state?: string;
    };
    if (command.json) printJson(data);
    else printOk(data.cancelled ? "download canceled" : `download is already ${data.state ?? "terminal"}`);
    return;
  }

  if (command.name === "self-update") {
    const data = await selfUpdate(VERSION, command.checkOnly);
    if (command.json) printJson(data);
    else printOk(data.status === "up-to-date" ? `already current (${data.latest})` : `${data.status}: ${data.latest}`);
    return;
  }

  if (command.name === "upload") {
    await ensureFile(command.file);
    const file = Bun.file(command.file);
    const upload = await requestJson({
      method: "POST",
      path: "/api/upload",
      body: { action: "upload-url" },
      config,
    }) as { uploadUrl?: string };
    if (!upload.uploadUrl) throw new CliError("server did not return an upload URL", "UPLOAD_ERROR", 2);
    const response = await fetch(upload.uploadUrl, {
      method: "POST",
      headers: { "content-type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!response.ok) throw new CliError(`upload failed with ${response.status}`, "UPLOAD_ERROR", 2);
    const stored = await response.json() as { storageId?: string };
    if (!stored.storageId) throw new CliError("storage response did not include storageId", "UPLOAD_ERROR", 2);
    const data = await requestJson({
      method: "POST",
      path: "/api/upload",
      body: {
        storageId: stored.storageId,
        title: command.title ?? basename(command.file),
        contentType: file.type,
        sizeBytes: file.size,
      },
      config,
    });
    if (command.json) printJson(data);
    else printOk("upload complete");
  }
}

async function waitForDownload(config: Awaited<ReturnType<typeof loadConfig>>, jobId: string) {
  for (;;) {
    const job = await requestJson({ path: `/api/download/${encodeURIComponent(jobId)}`, config }) as {
      state?: string;
      title?: string;
      format?: "mp4" | "mp3";
      videoUrl?: string | null;
      error?: string;
    };
    if (job.state === "completed" && job.videoUrl) return { ...job, videoUrl: job.videoUrl };
    if (job.state === "failed" || job.state === "cancelled") throw new CliError(job.error ?? `download ${job.state}`, "DOWNLOAD_FAILED", 2);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function ensureFile(file: string) {
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) throw new CliError(`file not found: ${file}`);
}
