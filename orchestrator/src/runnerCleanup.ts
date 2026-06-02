import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Args = {
  dryRun: boolean;
  keepLast: number;
  keepDays: number;
  protectedRuns: Set<string>;
};

type RunEntry = {
  name: string;
  fullPath: string;
  mtimeMs: number;
  sizeBytes: number;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseArgs(argv: string[]): Args {
  let dryRun = false;
  let keepLast = parsePositiveInt(process.env.RUNNER_CLEANUP_KEEP_LAST, 10);
  let keepDays = parsePositiveInt(process.env.RUNNER_CLEANUP_KEEP_DAYS, 7);
  const protectedRuns = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (item === "--keep-last") {
      keepLast = parsePositiveInt(argv[index + 1], keepLast);
      index += 1;
      continue;
    }
    if (item === "--keep-days") {
      keepDays = parsePositiveInt(argv[index + 1], keepDays);
      index += 1;
      continue;
    }
    if (item === "--protect-run") {
      const runId = argv[index + 1];
      if (!runId || !/^run-\d{4}-/.test(runId)) {
        throw new Error(`Invalid protected run ID: ${runId || "<missing>"}`);
      }
      protectedRuns.add(runId);
      index += 1;
      continue;
    }
    throw new Error("Usage: npm run runner:cleanup -- [--dry-run] [--keep-last 10] [--keep-days 7] [--protect-run <run-id>]");
  }

  return { dryRun, keepLast, keepDays, protectedRuns };
}

function getDirectorySize(dirPath: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirectorySize(fullPath);
      continue;
    }
    if (entry.isFile()) {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

function formatMb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function assertSafeRunDirectory(runsRoot: string, entry: fs.Dirent) {
  if (entry.isSymbolicLink()) {
    throw new Error(`Refusing to inspect symbolic link in runs directory: ${entry.name}`);
  }

  const resolvedRoot = path.resolve(runsRoot);
  const fullPath = path.resolve(resolvedRoot, entry.name);
  if (path.dirname(fullPath) !== resolvedRoot || !/^run-\d{4}-/.test(entry.name)) {
    throw new Error(`Refusing unsafe run directory path: ${entry.name}`);
  }

  return fullPath;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const orchestratorRoot = path.resolve(__dirname, "..");
  const runsRoot = path.join(orchestratorRoot, "runs");

  console.log("# Runner Cleanup");
  console.log(`Runs dir: ${runsRoot}`);
  console.log(`Dry run: ${args.dryRun ? "yes" : "no"}`);
  console.log(`Keep last: ${args.keepLast}`);
  console.log(`Keep days: ${args.keepDays}`);
  console.log(`Protected runs: ${[...args.protectedRuns].join(", ") || "none"}`);
  console.log("");

  if (!fs.existsSync(runsRoot)) {
    console.log("No runs directory found.");
    return;
  }

  const now = Date.now();
  const keepMs = args.keepDays * 24 * 60 * 60 * 1000;
  const entries: RunEntry[] = fs.readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^run-\d{4}-/.test(entry.name))
    .map((entry) => {
      const fullPath = assertSafeRunDirectory(runsRoot, entry);
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        fullPath,
        mtimeMs: stat.mtimeMs,
        sizeBytes: getDirectorySize(fullPath),
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  let totalBytes = 0;
  let deletedBytes = 0;
  let deletedCount = 0;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    totalBytes += entry.sizeBytes;
    const withinKeepLast = index < args.keepLast;
    const withinKeepDays = now - entry.mtimeMs <= keepMs;
    const protectedRun = args.protectedRuns.has(entry.name);
    const shouldDelete = !protectedRun && !withinKeepLast && !withinKeepDays;

    const action = protectedRun ? "protect" : shouldDelete ? (args.dryRun ? "would delete" : "delete") : "keep";
    console.log(`${action}: ${entry.name} (${formatMb(entry.sizeBytes)})`);

    if (shouldDelete) {
      deletedCount += 1;
      deletedBytes += entry.sizeBytes;
      if (!args.dryRun) {
        fs.rmSync(entry.fullPath, { recursive: true, force: true });
      }
    }
  }

  console.log("");
  console.log(`Runs scanned: ${entries.length}`);
  console.log(`Total size: ${formatMb(totalBytes)}`);
  console.log(`${args.dryRun ? "Would delete" : "Deleted"}: ${deletedCount} runs (${formatMb(deletedBytes)})`);
}

main();
