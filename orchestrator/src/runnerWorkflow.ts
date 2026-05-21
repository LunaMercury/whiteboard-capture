import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRunnerManifest, readWorkerResult, readWorkerTask, writeWorkerResult } from "./packetStore.js";
import type { WorkerTaskPacket } from "./taskSchemas.js";
import type { WorkerResultPacket } from "./resultSchemas.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type WorkerProvider = "claude" | "openai" | "manual";
type ApplyProvider = "openai" | "manual";

type Args = {
  runId: string;
  workerProvider: WorkerProvider;
  applyProvider: ApplyProvider;
  roles?: WorkerTaskPacket["role"][];
  continueOnError: boolean;
  applyReview: boolean;
  skipFinalize: boolean;
};

function parseArgs(argv: string[]): Args {
  let workerProvider: WorkerProvider = (process.env.WORKER_PROVIDER as WorkerProvider) || "openai";
  let applyProvider: ApplyProvider = (process.env.APPLY_PROVIDER as ApplyProvider) || "openai";
  let roles: WorkerTaskPacket["role"][] | undefined;
  const remaining: string[] = [];
  let continueOnError = false;
  let applyReview = false;
  let skipFinalize = false;

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
    if (item === "--skip-finalize") {
      skipFinalize = true;
      continue;
    }
    remaining.push(item);
  }

  const [runId] = remaining;

  if (!runId) {
    throw new Error(
      "Usage: npm run runner:workflow -- <run-id> [--worker-provider openai|claude|manual] [--apply-provider openai|manual] [--roles frontend,java] [--apply-review] [--continue-on-error] [--skip-finalize]",
    );
  }

  return {
    runId,
    workerProvider,
    applyProvider,
    roles,
    continueOnError,
    applyReview,
    skipFinalize,
  };
}

function runNodeScript(scriptPath: string, scriptArgs: string[], cwd: string) {
  const tsxCliPath = path.join(cwd, "node_modules", "tsx", "dist", "cli.mjs");
  return spawnSync(process.execPath, [tsxCliPath, scriptPath, ...scriptArgs], {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function runCommand(command: string, args: string[], cwd: string) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function printChildOutput(child: ReturnType<typeof runNodeScript>, label: string) {
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

function runVerificationScript(
  manifest: ReturnType<typeof readRunnerManifest>,
  role: WorkerTaskPacket["role"],
  verificationScript: string,
) {
  const child = runCommand(
    "powershell",
    ["-ExecutionPolicy", "Bypass", "-File", verificationScript],
    manifest.repoRoot,
  );

  printChildOutput(child, `verify ${role}`);

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

async function main() {
  const { runId, workerProvider, applyProvider, roles, continueOnError, applyReview, skipFinalize } = parseArgs(
    process.argv.slice(2),
  );
  const orchestratorRoot = path.resolve(__dirname, "..");
  const manifest = readRunnerManifest(orchestratorRoot, runId);

  const targetWorkers = manifest.workers.filter((worker) => !roles || roles.includes(worker.role));
  if (targetWorkers.length === 0) {
    throw new Error("No workers matched the requested roles.");
  }

  console.log("# Runner Workflow");
  console.log(`Run ID: ${runId}`);
  console.log(`Worker provider: ${workerProvider}`);
  console.log(`Apply provider: ${applyProvider}`);
  console.log(`Workers: ${targetWorkers.map((item) => item.role).join(", ")}`);
  console.log(`Apply review roles: ${applyReview ? "yes" : "no"}`);
  console.log("");

  for (const worker of targetWorkers) {
    console.log(`## Worker ${worker.role}`);
    const workerRun = runNodeScript(
      path.join("src", "workerRun.ts"),
      [runId, worker.role, "--provider", workerProvider],
      orchestratorRoot,
    );
    printChildOutput(workerRun, `worker ${worker.role}`);

    if (workerRun.status !== 0) {
      console.error(`worker ${worker.role} failed with exit code ${workerRun.status}`);
      if (!continueOnError) {
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

    if (!applyDecision.apply) {
      console.log(`Skipping apply for ${worker.role}: ${applyDecision.reason}`);
      console.log("");
      continue;
    }

    console.log(`Preparing apply for ${worker.role}: ${applyDecision.reason}`);
    const applyPrepare = runNodeScript(
      path.join("src", "applyExecutor.ts"),
      [runId, worker.role],
      orchestratorRoot,
    );
    printChildOutput(applyPrepare, `apply:prepare ${worker.role}`);

    if (applyPrepare.status !== 0) {
      console.error(`apply:prepare ${worker.role} failed with exit code ${applyPrepare.status}`);
      if (!continueOnError) {
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
    printChildOutput(applyRun, `apply:run ${worker.role}`);

    if (applyRun.status !== 0) {
      console.error(`apply:run ${worker.role} failed with exit code ${applyRun.status}`);
      if (!continueOnError) {
        process.exit(applyRun.status ?? 1);
      }
    }

    console.log("");
  }

  console.log("## Running verification");
  for (const worker of targetWorkers) {
    const result = readWorkerResult(manifest, worker.role);
    const task = readWorkerTask(manifest, worker.role);

    if (result.status !== "succeeded") {
      console.log(`Skipping verification for ${worker.role}: worker status is ${result.status}.`);
      continue;
    }

    const verificationScripts = Array.from(new Set(task.requiredVerification)).filter((item) => item.endsWith(".ps1"));
    if (verificationScripts.length === 0) {
      console.log(`Skipping verification for ${worker.role}: no PowerShell verification scripts were listed.`);
      continue;
    }

    console.log(`### Verify ${worker.role}`);
    for (const verificationScript of verificationScripts) {
      console.log(`Running ${verificationScript}`);
      const verify = runVerificationScript(manifest, worker.role, verificationScript);
      if (verify.status !== 0 && !continueOnError) {
        process.exit(verify.status ?? 1);
      }
    }
  }

  console.log("## Collecting results");
  const collect = runNodeScript(path.join("src", "collectResults.ts"), [runId], orchestratorRoot);
  printChildOutput(collect, "collect");
  if (collect.status !== 0 && !continueOnError) {
    process.exit(collect.status ?? 1);
  }

  if (!skipFinalize) {
    console.log("");
    console.log("## Finalizing run");
    const finalize = runNodeScript(path.join("src", "runnerFinalize.ts"), [runId], orchestratorRoot);
    printChildOutput(finalize, "finalize");
    if (finalize.status !== 0 && !continueOnError) {
      process.exit(finalize.status ?? 1);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
