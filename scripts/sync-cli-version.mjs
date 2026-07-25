#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";

const cliPath = "cli/version.json";
const publicPath = "public/zap-version.json";
const manifest = JSON.parse(readFileSync(cliPath, "utf8"));
const version = String(manifest.version ?? "").trim();

if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid CLI version: ${version || "<empty>"}`);

const releaseUrl = typeof manifest.releaseUrl === "string" && manifest.releaseUrl.trim()
  ? manifest.releaseUrl.trim()
  : "https://github.com/egeuysall/zap/releases";
const body = `${JSON.stringify({ version, releaseUrl }, null, 2)}\n`;

writeFileSync(cliPath, body);
writeFileSync(publicPath, body);
