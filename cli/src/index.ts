#!/usr/bin/env bun

import { parseArgv } from "./args";
import { runCommand } from "./commands";
import { renderHelp } from "./output";
import { CliError } from "./types";
import { VERSION } from "./version";

export async function main(argv = Bun.argv.slice(2)) {
  const command = parseArgv(argv);
  if (command.name === "help") return renderHelp();
  if (command.name === "version") return process.stdout.write(`${VERSION}\n`);
  await runCommand(command);
}

if (import.meta.main) {
  main().catch((error) => {
    const cliError = error instanceof CliError ? error : new CliError(error instanceof Error ? error.message : String(error), "UNHANDLED", 1);
    if (Bun.argv.includes("--json") || Bun.argv.includes("-j")) {
      process.stderr.write(`${JSON.stringify({ error: { code: cliError.code, message: cliError.message } }, null, 2)}\n`);
      process.exit(cliError.exitCode);
    }
    process.stderr.write(`error: ${cliError.message}\n`);
    process.exit(cliError.exitCode);
  });
}
