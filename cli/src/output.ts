const supportsColor = () => Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

export const color = {
  brand: (value: string) => paint(value, "31"),
  muted: (value: string) => paint(value, "90"),
  bold: (value: string) => paint(value, "1"),
  green: (value: string) => paint(value, "32"),
  yellow: (value: string) => paint(value, "33"),
};

export function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printOk(message: string) {
  process.stdout.write(`${color.green("ok")} ${message}\n`);
}

export function printTable(title: string, rows: Array<Record<string, unknown>>) {
  process.stdout.write(`${color.bold(title)}\n`);
  if (rows.length === 0) {
    process.stdout.write(`${color.muted("empty")}\n`);
    return;
  }
  for (const row of rows) {
    process.stdout.write(Object.entries(row).map(([key, value]) => `${color.muted(key)}=${String(value)}`).join("  "));
    process.stdout.write("\n");
  }
}

export function renderHelp() {
  const line = color.muted("─".repeat(58));
  process.stdout.write(`${color.brand("███████╗ █████╗ ██████╗")}\n`);
  process.stdout.write(`${color.brand("╚══███╔╝██╔══██╗██╔══██╗")}\n`);
  process.stdout.write(`${color.brand("  ███╔╝ ███████║██████╔╝")}\n`);
  process.stdout.write(`${color.brand(" ███╔╝  ██╔══██║██╔═══╝")}\n`);
  process.stdout.write(`${color.brand("███████╗██║  ██║██║")}\n`);
  process.stdout.write(`${color.muted("╚══════╝╚═╝  ╚═╝╚═╝")}  ${color.bold("zap")} ${color.muted("video downloader CLI")}\n`);
  process.stdout.write(`${line}\n`);
  section("Download", [
    ["zap download <url>", "process remotely, save to ~/Downloads"],
    ["zap local <url>", "process on this Mac, save to ~/Downloads"],
    ["zap download <url> --json", "remote job + local output JSON"],
    ["zap download status <jobId> --json", "read job status"],
    ["zap download list --limit 20", "list recent jobs"],
    ["zap download cancel <jobId>", "cancel a queued job"],
  ]);
  section("Files", [["zap upload ./video.mp4 --title demo", "upload a local file"]]);
  section("Account", [
    ["zap login", "open browser login"],
    ["zap login --api-key zak_...", "save key for automation"],
    ["zap whoami --json", "check local auth"],
    ["zap logout", "remove saved key"],
    ["zap self-update --check", "check GitHub release"],
  ]);
}

function section(title: string, rows: [string, string][]) {
  process.stdout.write(`\n${color.brand(title)} ${color.muted("─".repeat(22 - title.length))}\n`);
  for (const [command, description] of rows) {
    process.stdout.write(`${color.brand(">")} ${command.padEnd(43)} ${color.muted(description)}\n`);
  }
}

function paint(value: string, code: string) {
  return supportsColor() ? `\x1b[${code}m${value}\x1b[0m` : value;
}
