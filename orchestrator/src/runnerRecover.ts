import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRunnerManifest } from "./packetStore.js";
import type { WorkerResultPacket } from "./resultSchemas.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Args = {
  runId: string;
  dryRun: boolean;
  includeProposed: boolean;
};

type ApplyExecutionArtifact = {
  changedFiles?: string[];
  fileEdits?: Array<{
    path?: string;
  }>;
};

function parseArgs(argv: string[]): Args {
  const remaining: string[] = [];
  let dryRun = false;
  let includeProposed = false;

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (item === "--include-proposed") {
      includeProposed = true;
      continue;
    }
    remaining.push(item);
  }

  const [runId] = remaining;
  if (!runId) {
    throw new Error("Usage: npm run runner:recover -- <run-id> [--dry-run] [--include-proposed]");
  }

  return {
    runId,
    dryRun,
    includeProposed,
  };
}

function runCommand(command: string, args: string[], cwd: string) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function normalizeRepoRelativePath(repoRoot: string, candidate: string) {
  const normalizedCandidate = candidate.replaceAll("\\", "/").trim();
  if (!normalizedCandidate) {
    return undefined;
  }

  const absoluteCandidate = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(repoRoot, candidate);
  const relative = path.relative(repoRoot, absoluteCandidate);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }

  return relative.replaceAll("\\", "/");
}

function safeReadJson<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function collectApplyExecutionPaths(runDir: string) {
  const appliesDir = path.join(runDir, "applies");
  if (!fs.existsSync(appliesDir)) {
    return [];
  }

  return fs.readdirSync(appliesDir)
    .filter((fileName) => fileName.endsWith(".apply-result.json"))
    .flatMap((fileName) => {
      const artifact = safeReadJson<ApplyExecutionArtifact>(path.join(appliesDir, fileName));
      if (!artifact) {
        return [];
      }

      return [
        ...(artifact.changedFiles ?? []),
        ...((artifact.fileEdits ?? []).map((edit) => edit.path).filter((item): item is string => Boolean(item))),
      ];
    });
}

function collectWorkerResultPaths(manifest: ReturnType<typeof readRunnerManifest>, includeProposed: boolean) {
  return manifest.workers.flatMap((worker) => {
    const result = safeReadJson<WorkerResultPacket>(worker.resultFile);
    if (!result) {
      return [];
    }

    return [
      ...(result.changedFiles ?? []),
      ...(includeProposed ? (result.proposedEdits ?? []).map((edit) => edit.path) : []),
    ];
  });
}

function getTrackedPaths(repoRoot: string, pathspecs: string[]) {
  if (pathspecs.length === 0) {
    return [];
  }

  const child = runCommand("git", ["ls-files", "--", ...pathspecs], repoRoot);
  if (child.status !== 0) {
    throw new Error(child.stderr?.trim() || child.stdout?.trim() || "git ls-files failed");
  }

  return child.stdout
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPathStatus(repoRoot: string, pathspecs: string[]) {
  const args = pathspecs.length > 0
    ? ["status", "--porcelain", "--", ...pathspecs]
    : ["status", "--porcelain"];
  const child = runCommand("git", args, repoRoot);
  if (child.status !== 0) {
    throw new Error(child.stderr?.trim() || child.stdout?.trim() || "git status failed");
  }

  return child.stdout.trim();
}

function main() {
  const { runId, dryRun, includeProposed } = parseArgs(process.argv.slice(2));
  const orchestratorRoot = path.resolve(__dirname, "..");
  const manifest = readRunnerManifest(orchestratorRoot, runId);

  const rawPathspecs = [
    ...collectApplyExecutionPaths(manifest.runDir),
    ...collectWorkerResultPaths(manifest, includeProposed),
  ];
  const pathspecs = Array.from(
    new Set(
      rawPathspecs
        .map((item) => normalizeRepoRelativePath(manifest.repoRoot, item))
        .filter((item): item is string => Boolean(item)),
    ),
  ).sort();

  const trackedPaths = getTrackedPaths(manifest.repoRoot, pathspecs);
  const beforeStatus = getPathStatus(manifest.repoRoot, pathspecs);
  const summaryPath = path.join(manifest.runDir, "meta", "recovery-summary.json");

  console.log("# Runner Recover");
  console.log(`Run ID: ${runId}`);
  console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
  console.log(`Include proposed edits: ${includeProposed ? "yes" : "no"}`);
  console.log(`Candidate paths: ${pathspecs.length}`);

  if (pathspecs.length > 0) {
    for (const item of pathspecs) {
      console.log(`- ${item}`);
    }
  }

  let restoreStatus: number | null = null;
  let cleanStatus: number | null = null;
  let restoreOutput = "";
  let cleanOutput = "";

  if (!dryRun && pathspecs.length > 0) {
    const restore = trackedPaths.length > 0
      ? runCommand("git", ["restore", "--worktree", "--staged", "--", ...trackedPaths], manifest.repoRoot)
      : undefined;
    const clean = runCommand("git", ["clean", "-fd", "--", ...pathspecs], manifest.repoRoot);

    restoreStatus = restore?.status ?? 0;
    cleanStatus = clean.status;
    restoreOutput = [restore?.stdout, restore?.stderr].filter(Boolean).join("\n").trim();
    cleanOutput = [clean.stdout, clean.stderr].filter(Boolean).join("\n").trim();
  }

  const afterStatus = getPathStatus(manifest.repoRoot, pathspecs);
  const succeeded = dryRun || afterStatus.length === 0;

  writeJson(summaryPath, {
    runId,
    dryRun,
    includeProposed,
    pathspecs,
    trackedPaths,
    beforeStatus,
    afterStatus,
    restoreStatus,
    cleanStatus,
    restoreOutput,
    cleanOutput,
    succeeded,
  });

  console.log(`Recovery status: ${succeeded ? "succeeded" : "failed"}`);
  console.log(`Summary: ${summaryPath}`);

  if (beforeStatus) {
    console.log("");
    console.log("Before:");
    console.log(beforeStatus);
  }

  if (afterStatus) {
    console.log("");
    console.log("After:");
    console.log(afterStatus);
  }

  if (!succeeded) {
    process.exit(1);
  }
}

main();
