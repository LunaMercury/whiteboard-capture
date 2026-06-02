import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRunnerManifest, readWorkerResult, readWorkerTask, writeWorkerResult } from "./packetStore.js";
import type { WorkerTaskPacket } from "./taskSchemas.js";
import type { WorkerResultPacket } from "./resultSchemas.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type WorkerProvider = "claude" | "openai" | "manual" | "test";
type ApplyProvider = "openai" | "manual" | "test";

type Args = {
  runId: string;
  workerProvider: WorkerProvider;
  applyProvider: ApplyProvider;
  roles?: WorkerTaskPacket["role"][];
  continueOnError: boolean;
  applyReview: boolean;
  approveContractChanges: boolean;
  applyEdits: boolean;
  allowDirty: boolean;
  skipWorkers: boolean;
  verifyAll: boolean;
  skipFinalize: boolean;
  concurrency: number;
  rollbackAfterVerify: boolean;
  compact: boolean;
};

const primaryVerificationByRole: Record<WorkerTaskPacket["role"], string> = {
  frontend: ".skills/verify-web.ps1",
  rust: ".skills/verify-fast.ps1",
  java: ".skills/verify-core.ps1",
  mobile: ".skills/verify-mobile.ps1",
};

const snapshotMaxBytes = Number.parseInt(process.env.RUNNER_SNAPSHOT_MAX_BYTES || `${2 * 1024 * 1024}`, 10);
const verificationLogMaxBytes = Number.parseInt(process.env.RUNNER_VERIFICATION_LOG_MAX_BYTES || `${5 * 1024 * 1024}`, 10);
const verificationTimeoutMs = Number.parseInt(process.env.RUNNER_VERIFICATION_TIMEOUT_MS || `${10 * 60 * 1000}`, 10);

function parseArgs(argv: string[]): Args {
  let workerProvider: WorkerProvider = (process.env.WORKER_PROVIDER as WorkerProvider) || "openai";
  let applyProvider: ApplyProvider = (process.env.APPLY_PROVIDER as ApplyProvider) || "openai";
  let roles: WorkerTaskPacket["role"][] | undefined;
  const remaining: string[] = [];
  let continueOnError = false;
  let applyReview = false;
  let approveContractChanges = false;
  let applyEdits = false;
  let allowDirty = false;
  let skipWorkers = false;
  let verifyAll = false;
  let skipFinalize = false;
  let rollbackAfterVerify = false;
  let compact = false;
  let concurrency = Number.parseInt(process.env.RUNNER_CONCURRENCY || "1", 10);

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--worker-provider") {
      workerProvider = argv[index + 1] as WorkerProvider;
      index += 1;
      continue;
    }
    if (item === "--apply-provider") {
      applyProvider = argv[index + 1] as ApplyProvider;
      index += 1;
      continue;
    }
    if (item === "--roles") {
      roles = (argv[index + 1] ?? "")
        .split(",")
        .map((role) => role.trim())
        .filter((role): role is WorkerTaskPacket["role"] => ["frontend", "rust", "java", "mobile"].includes(role));
      index += 1;
      continue;
    }
    if (item === "--continue-on-error") {
      continueOnError = true;
      continue;
    }
    if (item === "--apply-review") {
      applyReview = true;
      continue;
    }
    if (item === "--approve-contract-changes") {
      approveContractChanges = true;
      continue;
    }
    if (item === "--apply") {
      applyEdits = true;
      continue;
    }
    if (item === "--allow-dirty") {
      allowDirty = true;
      continue;
    }
    if (item === "--skip-workers") {
      skipWorkers = true;
      continue;
    }
    if (item === "--verify-all") {
      verifyAll = true;
      continue;
    }
    if (item === "--rollback-after-verify") {
      rollbackAfterVerify = true;
      continue;
    }
    if (item === "--compact" || item === "--summary-only") {
      compact = true;
      continue;
    }
    if (item === "--skip-finalize") {
      skipFinalize = true;
      continue;
    }
    if (item === "--concurrency") {
      concurrency = Number.parseInt(argv[index + 1] || "1", 10);
      index += 1;
      continue;
    }
    remaining.push(item);
  }

  const [runId] = remaining;

  if (!runId) {
    throw new Error(
      "Usage: npm run runner:workflow -- <run-id> [--worker-provider openai|claude|manual|test] [--apply-provider openai|manual|test] [--roles frontend,java] [--concurrency 2] [--apply] [--rollback-after-verify] [--compact] [--allow-dirty] [--apply-review] [--approve-contract-changes] [--continue-on-error] [--skip-workers] [--verify-all] [--skip-finalize]",
    );
  }

  if (rollbackAfterVerify && !applyEdits) {
    throw new Error("--rollback-after-verify requires --apply so there are applied edits to verify and roll back.");
  }

  return {
    runId,
    workerProvider,
    applyProvider,
    roles,
    continueOnError,
    applyReview,
    approveContractChanges,
    applyEdits,
    allowDirty,
    skipWorkers,
    verifyAll,
    skipFinalize,
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 1,
    rollbackAfterVerify,
    compact,
  };
}

type ChildResult = {
  stdout: string;
  stderr: string;
  status: number | null;
  signal: NodeJS.Signals | null;
  error?: Error;
};

const activeVerificationPids = new Set<number>();

function runNodeScript(scriptPath: string, scriptArgs: string[], cwd: string) {
  const tsxCliPath = path.join(cwd, "node_modules", "tsx", "dist", "cli.mjs");
  return spawnSync(process.execPath, [tsxCliPath, scriptPath, ...scriptArgs], {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function runNodeScriptAsync(scriptPath: string, scriptArgs: string[], cwd: string): Promise<ChildResult> {
  const tsxCliPath = path.join(cwd, "node_modules", "tsx", "dist", "cli.mjs");

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [tsxCliPath, scriptPath, ...scriptArgs], {
      cwd,
      stdio: "pipe",
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let spawnError: Error | undefined;

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("close", (status, signal) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        status,
        signal,
        error: spawnError,
      });
    });
  });
}

function runCommand(command: string, args: string[], cwd: string, timeoutMs?: number) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
    timeout: timeoutMs,
  });
}

function terminateProcessTree(pid: number) {
  if (process.platform === "win32") {
    return spawnSync("taskkill", ["/PID", `${pid}`, "/T", "/F"], {
      encoding: "utf8",
      stdio: "pipe",
    });
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    process.kill(pid, "SIGTERM");
  }

  return undefined;
}

function terminateActiveVerificationProcesses() {
  for (const pid of activeVerificationPids) {
    terminateProcessTree(pid);
  }
}

function runCommandStreaming(command: string, args: string[], cwd: string, timeoutMs: number): Promise<ChildResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "pipe",
      detached: process.platform !== "win32",
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let spawnError: Error | undefined;
    let timedOut = false;
    let settled = false;

    if (child.pid) {
      activeVerificationPids.add(child.pid);
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      process.stderr.write(chunk);
    });
    child.on("error", (error) => {
      spawnError = error;
      settle(null, null, error);
    });

    function settle(status: number | null, signal: NodeJS.Signals | null, error?: Error) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      if (child.pid) {
        activeVerificationPids.delete(child.pid);
      }
      child.stdout.destroy();
      child.stderr.destroy();
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        status,
        signal,
        error,
      });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        terminateProcessTree(child.pid);
      }
      settle(null, null, new Error(`Verification timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.on("exit", (status, signal) => {
      settle(
        status,
        signal,
        timedOut ? new Error(`Verification timed out after ${timeoutMs}ms.`) : spawnError,
      );
    });
  });
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeText(filePath: string, content: string) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function writeTextLimited(filePath: string, content: string, maxBytes: number) {
  const contentBuffer = Buffer.from(content, "utf8");
  if (!Number.isFinite(maxBytes) || maxBytes <= 0 || contentBuffer.byteLength <= maxBytes) {
    writeText(filePath, content);
    return {
      truncated: false,
      originalBytes: contentBuffer.byteLength,
      writtenBytes: contentBuffer.byteLength,
    };
  }

  const marker = `\n\n[truncated: original ${contentBuffer.byteLength} bytes exceeded limit ${maxBytes} bytes]\n`;
  const markerBuffer = Buffer.from(marker, "utf8");
  const sliceBytes = Math.max(0, maxBytes - markerBuffer.byteLength);
  const truncatedContent = Buffer.concat([contentBuffer.subarray(0, sliceBytes), markerBuffer]).toString("utf8");
  writeText(filePath, truncatedContent);

  return {
    truncated: true,
    originalBytes: contentBuffer.byteLength,
    writtenBytes: Buffer.byteLength(truncatedContent, "utf8"),
  };
}

function writeJson(filePath: string, data: unknown) {
  writeText(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function formatChildLog(child: ChildResult | ReturnType<typeof runNodeScript>) {
  return [
    `status: ${child.status ?? "null"}`,
    `signal: ${child.signal ?? "null"}`,
    child.error ? `error: ${child.error.message}` : undefined,
    "",
    "## stdout",
    child.stdout || "",
    "",
    "## stderr",
    child.stderr || "",
  ].filter((item): item is string => item !== undefined).join("\n");
}

function printChildOutput(child: ChildResult | ReturnType<typeof runNodeScript>, label: string) {
  if (child.stdout?.trim()) {
    console.log(child.stdout.trim());
  }
  if (child.stderr?.trim()) {
    console.error(child.stderr.trim());
  }
  if (child.error) {
    console.error(`${label} spawn error: ${child.error.message}`);
  }
  if (child.signal) {
    console.error(`${label} signal: ${child.signal}`);
  }
}

function printChildSummary(child: ChildResult | ReturnType<typeof runNodeScript>, label: string) {
  const status = child.status ?? "null";
  const signal = child.signal ? ` signal=${child.signal}` : "";
  const error = child.error ? ` error=${child.error.message}` : "";
  console.log(`${label}: exit=${status}${signal}${error}`);
  if (child.status !== 0) {
    const message = child.stderr?.trim() || child.stdout?.trim();
    if (message) {
      console.error(message.split(/\r?\n/).slice(0, 8).join("\n"));
    }
  }
}

function printWorkflowChild(child: ChildResult | ReturnType<typeof runNodeScript>, label: string, compact: boolean) {
  if (compact) {
    printChildSummary(child, label);
    return;
  }
  printChildOutput(child, label);
}

function printStreamingCompletion(child: ChildResult, label: string) {
  const status = child.status ?? "null";
  const signal = child.signal ? ` signal=${child.signal}` : "";
  const error = child.error ? ` error=${child.error.message}` : "";
  console.log(`${label}: exit=${status}${signal}${error}`);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results = new Map<T, R>();
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  async function runNext() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = items[currentIndex];
      results.set(item, await worker(item));
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
  return results;
}

function shouldApplyRole(
  task: WorkerTaskPacket,
  proposedEditCount: number,
  applyReview: boolean,
) {
  if (proposedEditCount === 0) {
    return {
      apply: false,
      reason: "No proposed edits were returned.",
    };
  }

  if (task.participationMode === "implement") {
    return {
      apply: true,
      reason: "Implement role with proposed edits.",
    };
  }

  if (task.participationMode === "review" && applyReview) {
    return {
      apply: true,
      reason: "Review role explicitly allowed via --apply-review.",
    };
  }

  return {
    apply: false,
    reason: `Participation mode is ${task.participationMode}.`,
  };
}

function updateWorkerResultWithVerificationFailure(
  manifest: ReturnType<typeof readRunnerManifest>,
  role: WorkerTaskPacket["role"],
  verificationLabel: string,
  failureMessage: string,
) {
  const existing = readWorkerResult(manifest, role);
  const risks = Array.from(new Set([...existing.risks, `Verification failed: ${verificationLabel}`, failureMessage]));
  const verificationRun = Array.from(new Set([...existing.verificationRun, verificationLabel]));

  const next: WorkerResultPacket = {
    ...existing,
    status: "failed",
    summary: `${existing.summary} Verification failed during workflow.`,
    verificationRun,
    risks,
  };

  writeWorkerResult(manifest, next);
}

function updateWorkerResultWithApplyReviewFailure(
  manifest: ReturnType<typeof readRunnerManifest>,
  role: WorkerTaskPacket["role"],
  failureMessage: string,
) {
  const existing = readWorkerResult(manifest, role);
  const risks = Array.from(new Set([...existing.risks, `Apply review blocked: ${failureMessage}`]));

  writeWorkerResult(manifest, {
    ...existing,
    status: "failed",
    summary: `${existing.summary} Apply review blocked before file changes.`,
    risks,
  });
}

async function runVerificationScript(
  manifest: ReturnType<typeof readRunnerManifest>,
  role: WorkerTaskPacket["role"],
  verificationScript: string,
  logFile?: string,
) {
  const child = await runCommandStreaming(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-File", verificationScript],
    manifest.repoRoot,
    verificationTimeoutMs,
  );

  printStreamingCompletion(child, `verify ${role}`);

  if (child.status !== 0) {
    const failureMessage =
      child.stderr?.trim() ||
      child.stdout?.trim() ||
      `verification exited with code ${child.status ?? "unknown"}`;
    updateWorkerResultWithVerificationFailure(manifest, role, verificationScript, failureMessage);
  } else {
    const existing = readWorkerResult(manifest, role);
    const verificationRun = Array.from(new Set([...existing.verificationRun, verificationScript]));
    writeWorkerResult(manifest, {
      ...existing,
      verificationRun,
    });
  }

  return child;
}

function getWorkflowVerificationScripts(role: WorkerTaskPacket["role"]) {
  return [primaryVerificationByRole[role]];
}

function updateWorkerResultWithVerificationSuccess(
  manifest: ReturnType<typeof readRunnerManifest>,
  role: WorkerTaskPacket["role"],
  verificationLabel: string,
) {
  const existing = readWorkerResult(manifest, role);
  const verificationRun = Array.from(new Set([...existing.verificationRun, verificationLabel]));
  writeWorkerResult(manifest, {
    ...existing,
    verificationRun,
  });
}

function getDirtyWorktreeOutput(repoRoot: string) {
  const child = runCommand("git", ["status", "--porcelain"], repoRoot);
  if (child.status !== 0) {
    throw new Error(child.stderr?.trim() || child.stdout?.trim() || "git status failed");
  }

  return child.stdout.trim();
}

function getWorkflowDirs(manifest: ReturnType<typeof readRunnerManifest>) {
  return {
    snapshotsDir: path.join(manifest.runDir, "snapshots"),
    verificationDir: path.join(manifest.runDir, "verification"),
    metaDir: path.join(manifest.runDir, "meta"),
  };
}

function runRelativePath(manifest: ReturnType<typeof readRunnerManifest>, filePath: string) {
  return path.relative(manifest.runDir, filePath).replaceAll("\\", "/");
}

function renderAddedFileDiff(repoRoot: string, repoRelativePath: string) {
  const fullPath = path.join(repoRoot, repoRelativePath);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return "";
  }

  const content = fs.readFileSync(fullPath, "utf8");
  const normalizedPath = repoRelativePath.replaceAll("\\", "/");
  const lines = content.split(/\r?\n/);
  return [
    `diff --git a/${normalizedPath} b/${normalizedPath}`,
    "new file mode 100644",
    "index 0000000..0000000",
    "--- /dev/null",
    `+++ b/${normalizedPath}`,
    "@@",
    ...lines.map((line) => `+${line}`),
    "",
  ].join("\n");
}

function renderUntrackedDiff(repoRoot: string, statusOutput: string) {
  return statusOutput
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("?? "))
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .map((repoRelativePath) => renderAddedFileDiff(repoRoot, repoRelativePath))
    .filter(Boolean)
    .join("\n");
}

function captureGitSnapshot(
  manifest: ReturnType<typeof readRunnerManifest>,
  name: string,
  pathspecs: string[] = [],
) {
  const { snapshotsDir } = getWorkflowDirs(manifest);
  const safeName = name.replace(/[^a-zA-Z0-9_.-]/g, "-");
  const args = ["diff", "--binary", "--", ...pathspecs];
  const diff = runCommand("git", args, manifest.repoRoot);
  const statusArgs = pathspecs.length > 0
    ? ["status", "--porcelain", "--", ...pathspecs]
    : ["status", "--porcelain"];
  const status = runCommand("git", statusArgs, manifest.repoRoot);
  const untrackedDiff = renderUntrackedDiff(manifest.repoRoot, status.stdout || "");
  const combinedDiff = [diff.stdout || "", untrackedDiff].filter((item) => item.trim()).join("\n");

  const diffPath = path.join(snapshotsDir, `${safeName}.diff`);
  const statusPath = path.join(snapshotsDir, `${safeName}.status.txt`);
  const diffWrite = writeTextLimited(diffPath, combinedDiff, snapshotMaxBytes);
  const statusWrite = writeTextLimited(statusPath, status.stdout || "", snapshotMaxBytes);

  return {
    diffPath,
    statusPath,
    diffStatus: diff.status,
    statusStatus: status.status,
    diffWrite,
    statusWrite,
  };
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

function rollbackWorktree(manifest: ReturnType<typeof readRunnerManifest>, pathspecs: string[]) {
  const uniquePathspecs = Array.from(new Set(pathspecs)).filter(Boolean);
  if (uniquePathspecs.length === 0) {
    return {
      restore: { stdout: "", stderr: "", status: 0, signal: null } as ReturnType<typeof runCommand>,
      clean: { stdout: "", stderr: "", status: 0, signal: null } as ReturnType<typeof runCommand>,
      finalStatus: "",
      succeeded: true,
    };
  }

  const trackedPaths = getTrackedPaths(manifest.repoRoot, uniquePathspecs);
  const restore = trackedPaths.length > 0
    ? runCommand("git", ["restore", "--worktree", "--staged", "--", ...trackedPaths], manifest.repoRoot)
    : ({ stdout: "", stderr: "", status: 0, signal: null } as ReturnType<typeof runCommand>);
  const clean = uniquePathspecs.length > 0
    ? runCommand("git", ["clean", "-fd", "--", ...uniquePathspecs], manifest.repoRoot)
    : ({ stdout: "", stderr: "", status: 0, signal: null } as ReturnType<typeof runCommand>);
  const finalStatus = getPathStatus(manifest.repoRoot, uniquePathspecs);

  return {
    restore,
    clean,
    finalStatus,
    succeeded: restore.status === 0 && clean.status === 0 && finalStatus.length === 0,
  };
}

async function main() {
  const { runId, workerProvider, applyProvider, roles, continueOnError, applyReview, approveContractChanges, applyEdits, allowDirty, skipWorkers, verifyAll, skipFinalize, concurrency, rollbackAfterVerify, compact } = parseArgs(
    process.argv.slice(2),
  );
  const orchestratorRoot = path.resolve(__dirname, "..");
  const manifest = readRunnerManifest(orchestratorRoot, runId);

  const targetWorkers = manifest.workers.filter((worker) => !roles || roles.includes(worker.role));
  if (targetWorkers.length === 0) {
    throw new Error("No workers matched the requested roles.");
  }

  if (applyEdits && !allowDirty) {
    const dirtyOutput = getDirtyWorktreeOutput(manifest.repoRoot);
    if (dirtyOutput) {
      throw new Error(
        [
          "Refusing to apply worker edits because the git worktree is not clean.",
          "Commit, stash, or revert existing changes first, or re-run with --allow-dirty if you intentionally want to apply on top of them.",
          "",
          dirtyOutput,
        ].join("\n"),
      );
    }
  }

  console.log("# Runner Workflow");
  console.log(`Run ID: ${runId}`);
  console.log(`Worker provider: ${workerProvider}`);
  console.log(`Apply provider: ${applyProvider}`);
  console.log(`Workers: ${targetWorkers.map((item) => item.role).join(", ")}`);
  console.log(`Apply edits: ${applyEdits ? "yes" : "no"}`);
  console.log(`Allow dirty worktree: ${allowDirty ? "yes" : "no"}`);
  console.log(`Apply review roles: ${applyReview ? "yes" : "no"}`);
  console.log(`Approve contract changes: ${approveContractChanges ? "yes" : "no"}`);
  console.log(`Skip workers/apply: ${skipWorkers ? "yes" : "no"}`);
  console.log(`Verify all: ${verifyAll ? "yes" : "no"}`);
  console.log(`Worker concurrency: ${concurrency}`);
  console.log(`Rollback after verify: ${rollbackAfterVerify ? "yes" : "no"}`);
  console.log(`Compact output: ${compact ? "yes" : "no"}`);
  console.log("");

  const rollbackSummary: {
    enabled: boolean;
    snapshots: Array<{ label: string; diffPath: string; statusPath: string; diffTruncated: boolean; statusTruncated: boolean }>;
    verificationLogs: Array<{ role: WorkerTaskPacket["role"] | "all"; script: string; logPath: string; status: number | null; truncated: boolean }>;
    rollback?: {
      restoreStatus: number | null;
      cleanStatus: number | null;
      finalWorktreeClean: boolean;
      finalStatus: string;
    };
  } = {
    enabled: rollbackAfterVerify,
    snapshots: [],
    verificationLogs: [],
  };
  let workflowExitCode = 0;
  const rollbackPathspecs: string[] = [];
  const appliedRoles = new Set<WorkerTaskPacket["role"]>();
  let rollbackCompleted = false;

  function performRollback() {
    if (!rollbackAfterVerify || rollbackCompleted) {
      return;
    }

    console.log("## Rolling back applied edits");
    const finalSnapshot = captureGitSnapshot(manifest, "after-verification-before-rollback");
    rollbackSummary.snapshots.push({
      label: "after-verification-before-rollback",
      diffPath: runRelativePath(manifest, finalSnapshot.diffPath),
      statusPath: runRelativePath(manifest, finalSnapshot.statusPath),
      diffTruncated: finalSnapshot.diffWrite.truncated,
      statusTruncated: finalSnapshot.statusWrite.truncated,
    });

    const rollback = rollbackWorktree(manifest, rollbackPathspecs);
    printWorkflowChild(rollback.restore, "rollback restore", compact);
    printWorkflowChild(rollback.clean, "rollback clean", compact);
    rollbackSummary.rollback = {
      restoreStatus: rollback.restore.status,
      cleanStatus: rollback.clean.status,
      finalWorktreeClean: rollback.succeeded,
      finalStatus: rollback.finalStatus,
    };
    writeJson(path.join(getWorkflowDirs(manifest).metaDir, "rollback-summary.json"), rollbackSummary);
    rollbackCompleted = true;

    console.log(`Rollback status: ${rollback.succeeded ? "succeeded" : "failed"}`);
    console.log(`Rollback summary: ${path.join(getWorkflowDirs(manifest).metaDir, "rollback-summary.json")}`);
    if (!rollback.succeeded) {
      console.error(rollback.finalStatus || "Rollback failed but no git status output was available.");
      workflowExitCode = workflowExitCode || 1;
    }
    console.log("");
  }

  function handleTermination(signal: NodeJS.Signals) {
    console.error(`Received ${signal}. Attempting rollback before exit.`);
    try {
      terminateActiveVerificationProcesses();
      performRollback();
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
    process.exit(workflowExitCode || 130);
  }

  process.once("SIGINT", handleTermination);
  process.once("SIGTERM", handleTermination);

  if (rollbackAfterVerify) {
    const beforeSnapshot = captureGitSnapshot(manifest, "before-apply");
    rollbackSummary.snapshots.push({
      label: "before-apply",
      diffPath: runRelativePath(manifest, beforeSnapshot.diffPath),
      statusPath: runRelativePath(manifest, beforeSnapshot.statusPath),
      diffTruncated: beforeSnapshot.diffWrite.truncated,
      statusTruncated: beforeSnapshot.statusWrite.truncated,
    });
  }

  try {
  if (skipWorkers) {
    console.log("## Worker/apply stage skipped");
    console.log("Using existing worker result packets for verification and finalization.");
    console.log("");
  } else {
    const workerRuns = await mapWithConcurrency(targetWorkers, concurrency, async (worker) => {
      console.log(`## Worker ${worker.role}`);
      const workerRun = await runNodeScriptAsync(
        path.join("src", "workerRun.ts"),
        [runId, worker.role, "--provider", workerProvider],
        orchestratorRoot,
      );
      printWorkflowChild(workerRun, `worker ${worker.role}`, compact);
      return workerRun;
    });

    for (const worker of targetWorkers) {
      const workerRun = workerRuns.get(worker);
      if (!workerRun) {
        throw new Error(`Worker result missing for ${worker.role}`);
      }
      if (workerRun.status !== 0) {
        console.error(`worker ${worker.role} failed with exit code ${workerRun.status}`);
        if (!continueOnError) {
          if (rollbackAfterVerify) {
            workflowExitCode = workerRun.status ?? 1;
            console.log("");
            continue;
          }
          process.exit(workerRun.status ?? 1);
        }
        console.log("");
        continue;
      }

      const task = readWorkerTask(manifest, worker.role);
      const result = readWorkerResult(manifest, worker.role);
      const applyDecision = shouldApplyRole(task, result.proposedEdits?.length ?? 0, applyReview);

      if (result.status !== "succeeded") {
        console.log(`Skipping apply for ${worker.role}: worker status is ${result.status}.`);
        console.log("");
        continue;
      }

      if (!applyEdits) {
        console.log(`Skipping apply for ${worker.role}: apply is disabled by default. Re-run with --apply to modify files.`);
        console.log("");
        continue;
      }

      if (!applyDecision.apply) {
        console.log(`Skipping apply for ${worker.role}: ${applyDecision.reason}`);
        console.log("");
        continue;
      }

      console.log(`Reviewing apply safety for ${worker.role}.`);
      const applyReviewRun = runNodeScript(
        path.join("src", "applyReview.ts"),
        [runId, worker.role, ...(approveContractChanges ? ["--approve-contract-changes"] : [])],
        orchestratorRoot,
      );
      printWorkflowChild(applyReviewRun, `apply:review ${worker.role}`, compact);

      if (applyReviewRun.status !== 0) {
        console.error(`apply:review ${worker.role} blocked or failed with exit code ${applyReviewRun.status}`);
        const failureMessage =
          applyReviewRun.stderr?.trim() ||
          applyReviewRun.stdout?.trim() ||
          `apply review exited with code ${applyReviewRun.status ?? "unknown"}`;
        updateWorkerResultWithApplyReviewFailure(manifest, worker.role, failureMessage);
        if (!continueOnError) {
          if (rollbackAfterVerify) {
            workflowExitCode = applyReviewRun.status ?? 1;
            console.log("");
            continue;
          }
          process.exit(applyReviewRun.status ?? 1);
        }
        console.log("");
        continue;
      }

      console.log(`Preparing apply for ${worker.role}: ${applyDecision.reason}`);
      const applyPrepare = runNodeScript(
        path.join("src", "applyExecutor.ts"),
        [runId, worker.role],
        orchestratorRoot,
      );
      printWorkflowChild(applyPrepare, `apply:prepare ${worker.role}`, compact);

      if (applyPrepare.status !== 0) {
        console.error(`apply:prepare ${worker.role} failed with exit code ${applyPrepare.status}`);
        if (!continueOnError) {
          if (rollbackAfterVerify) {
            workflowExitCode = applyPrepare.status ?? 1;
            console.log("");
            continue;
          }
          process.exit(applyPrepare.status ?? 1);
        }
        console.log("");
        continue;
      }

      const applyRun = runNodeScript(
        path.join("src", "applyRun.ts"),
        [runId, worker.role, "--provider", applyProvider],
        orchestratorRoot,
      );
      printWorkflowChild(applyRun, `apply:run ${worker.role}`, compact);

      if (applyRun.status !== 0) {
        console.error(`apply:run ${worker.role} failed with exit code ${applyRun.status}`);
        if (!continueOnError) {
          if (rollbackAfterVerify) {
            workflowExitCode = applyRun.status ?? 1;
          } else {
            process.exit(applyRun.status ?? 1);
          }
        }
      } else {
        const resultAfterApply = readWorkerResult(manifest, worker.role);
        if (resultAfterApply.status === "succeeded" && (resultAfterApply.changedFiles?.length ?? 0) > 0) {
          appliedRoles.add(worker.role);
        }
      }

      if (rollbackAfterVerify) {
        const resultAfterApply = readWorkerResult(manifest, worker.role);
        const rolePaths = Array.from(new Set([
          ...(resultAfterApply.changedFiles ?? []),
          ...((resultAfterApply.proposedEdits ?? []).map((edit) => edit.path)),
        ])).filter(Boolean);
        rollbackPathspecs.push(...rolePaths);
        const snapshot = captureGitSnapshot(manifest, `${worker.role}-after-apply`, rolePaths);
        rollbackSummary.snapshots.push({
          label: `${worker.role}-after-apply`,
          diffPath: runRelativePath(manifest, snapshot.diffPath),
          statusPath: runRelativePath(manifest, snapshot.statusPath),
          diffTruncated: snapshot.diffWrite.truncated,
          statusTruncated: snapshot.statusWrite.truncated,
        });
      }

      console.log("");
    }
  }

  console.log("## Running verification");
  const verificationWorkers = skipWorkers
    ? targetWorkers
    : targetWorkers.filter((worker) => appliedRoles.has(worker.role));

  if (!applyEdits && !skipWorkers) {
    console.log("Skipping verification: no files were applied. Re-run with --apply to modify files and verify them.");
    console.log("");
  }

  if (applyEdits && !skipWorkers && verificationWorkers.length === 0) {
    console.log("Skipping verification: no worker edits were applied.");
    console.log("");
  }

  for (const worker of applyEdits || skipWorkers ? verificationWorkers : []) {
    const result = readWorkerResult(manifest, worker.role);
    if (result.status !== "succeeded") {
      console.log(`Skipping verification for ${worker.role}: worker status is ${result.status}.`);
      continue;
    }

    const verificationScripts = getWorkflowVerificationScripts(worker.role);
    if (verificationScripts.length === 0) {
      console.log(`Skipping verification for ${worker.role}: no PowerShell verification scripts were listed.`);
      continue;
    }

    console.log(`### Verify ${worker.role}`);
    for (const verificationScript of verificationScripts) {
      console.log(`Running ${verificationScript}`);
      const logPath = rollbackAfterVerify
        ? path.join(getWorkflowDirs(manifest).verificationDir, `${worker.role}.log`)
        : undefined;
      const verify = await runVerificationScript(manifest, worker.role, verificationScript, logPath);
      if (logPath) {
        const logWrite = writeTextLimited(logPath, formatChildLog(verify), verificationLogMaxBytes);
        rollbackSummary.verificationLogs.push({
          role: worker.role,
          script: verificationScript,
          logPath: runRelativePath(manifest, logPath),
          status: verify.status,
          truncated: logWrite.truncated,
        });
      }
      if (verify.status !== 0 && !continueOnError) {
        if (rollbackAfterVerify) {
          workflowExitCode = verify.status ?? 1;
        } else {
          process.exit(verify.status ?? 1);
        }
      }
    }
  }

  if (verifyAll && !applyEdits && !skipWorkers) {
    console.log("## Running full project verification");
    console.log("Skipping verify-all: no files were applied in this dry-run. Re-run with --apply or --skip-workers to verify existing applied results.");
    console.log("");
  }

  if (verifyAll && (applyEdits || skipWorkers)) {
    console.log("## Running full project verification");
    const verificationScript = ".skills/verify-all.ps1";
    console.log(`Running ${verificationScript}`);
    const verify = await runCommandStreaming(
      "powershell",
      ["-ExecutionPolicy", "Bypass", "-File", verificationScript],
      manifest.repoRoot,
      verificationTimeoutMs,
    );
    printStreamingCompletion(verify, "verify all");
    if (rollbackAfterVerify) {
      const logPath = path.join(getWorkflowDirs(manifest).verificationDir, "verify-all.log");
      const logWrite = writeTextLimited(logPath, formatChildLog(verify), verificationLogMaxBytes);
      rollbackSummary.verificationLogs.push({
        role: "all",
        script: verificationScript,
        logPath: runRelativePath(manifest, logPath),
        status: verify.status,
        truncated: logWrite.truncated,
      });
    }

    const succeededWorkers = targetWorkers
      .map((worker) => worker.role)
      .filter((role) => readWorkerResult(manifest, role).status === "succeeded");

    if (verify.status !== 0) {
      const failureMessage =
        verify.stderr?.trim() ||
        verify.stdout?.trim() ||
        `verification exited with code ${verify.status ?? "unknown"}`;
      for (const role of succeededWorkers) {
        updateWorkerResultWithVerificationFailure(manifest, role, verificationScript, failureMessage);
      }
      if (!continueOnError) {
        if (rollbackAfterVerify) {
          workflowExitCode = verify.status ?? 1;
        } else {
          process.exit(verify.status ?? 1);
        }
      }
    } else {
      for (const role of succeededWorkers) {
        updateWorkerResultWithVerificationSuccess(manifest, role, verificationScript);
      }
    }
  }

  } catch (error) {
    workflowExitCode = workflowExitCode || 1;
    console.error(error instanceof Error ? error.message : error);
  } finally {
    performRollback();
  }

  console.log("## Collecting results");
  const collectArgs = compact ? [runId, "--compact"] : [runId];
  const collect = runNodeScript(path.join("src", "collectResults.ts"), collectArgs, orchestratorRoot);
  printWorkflowChild(collect, "collect", compact);
  if (collect.status !== 0 && !continueOnError) {
    process.exit(collect.status ?? 1);
  }

  if (!skipFinalize) {
    console.log("");
    console.log("## Finalizing run");
    const finalizeArgs = compact ? [runId, "--compact"] : [runId];
    const finalize = runNodeScript(path.join("src", "runnerFinalize.ts"), finalizeArgs, orchestratorRoot);
    printWorkflowChild(finalize, "finalize", compact);
    if (finalize.status !== 0 && !continueOnError) {
      process.exit(finalize.status ?? 1);
    }
  }

  if (workflowExitCode !== 0) {
    process.exit(workflowExitCode);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
