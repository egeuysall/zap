import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CliError } from "./types";

const REPO = process.env.ZAP_GITHUB_REPO ?? "egeuysall/zap";

export async function selfUpdate(currentVersion: string, checkOnly = false) {
  const release = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "zap-cli" },
  });
  const data = await release.json().catch(() => ({})) as { tag_name?: string; html_url?: string };
  if (!release.ok || !data.tag_name) throw new CliError("could not read latest GitHub release", "UPDATE_FAILED", 2);
  const latest = data.tag_name.replace(/^v/, "");
  if (!isNewer(latest, currentVersion)) return { status: "up-to-date", latest, releaseUrl: data.html_url };
  if (checkOnly) return { status: "update-available", latest, releaseUrl: data.html_url };
  const scriptUrl = process.env.ZAP_INSTALLER_URL ??
    `https://raw.githubusercontent.com/${REPO}/${encodeURIComponent(data.tag_name)}/public/install.sh`;
  if (!isAllowedInstallerUrl(scriptUrl)) throw new CliError("unsafe installer URL", "UPDATE_FAILED", 2);
  const response = await fetch(scriptUrl, { headers: { accept: "text/plain,*/*", "user-agent": "zap-cli" } });
  if (!response.ok) throw new CliError(`installer download failed with ${response.status}`, "UPDATE_FAILED", 2);
  const script = await response.text();
  if (!script.includes("#!/usr/bin/env bash") && !script.includes("#!/bin/bash")) throw new CliError("installer payload is invalid", "UPDATE_FAILED", 2);
  const tmp = path.join(os.tmpdir(), `zap-install-${randomUUID()}.sh`);
  await writeFile(tmp, script, { mode: 0o700 });
  try {
    const result = spawnSync("/bin/bash", [tmp], {
      stdio: "inherit",
      env: { ...process.env, ZAP_RELEASE_TAG: data.tag_name },
    });
    if (result.status !== 0) throw new CliError(`installer exited with ${result.status}`, "UPDATE_FAILED", 2);
  } finally {
    await rm(tmp, { force: true });
  }
  return { status: "updated", latest, releaseUrl: data.html_url };
}

function isAllowedInstallerUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname));
  } catch {
    return false;
  }
}

function isNewer(remote: string, local: string) {
  const r = remote.split(".").map(Number);
  const l = local.split(".").map(Number);
  return (r[0] ?? 0) > (l[0] ?? 0) || ((r[0] ?? 0) === (l[0] ?? 0) && ((r[1] ?? 0) > (l[1] ?? 0) || ((r[1] ?? 0) === (l[1] ?? 0) && (r[2] ?? 0) > (l[2] ?? 0))));
}
