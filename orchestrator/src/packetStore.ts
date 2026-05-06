import fs from "node:fs";
import path from "node:path";
import type { ManagerDecision, VerifierReport } from "./schemas.js";
import type { WorkerTaskPacket } from "./taskSchemas.js";
import type { WorkerResultPacket } from "./resultSchemas.js";

export type RunnerManifest = {
  runId: string;
  createdAt: string;
  request: string;
  mode: "mock" | "live";
  repoRoot: string;
  runDir: string;
  tasksDir: string;
  resultsDir: string;
  reportPath: string;
  summaryPath: string;
  workers: Array<{
    role: WorkerTaskPacket["role"];
    taskFile: string;
    resultFile: string;
    status: WorkerResultPacket["status"];
  }>;
};

type RunnerBundleInput = {
  request: string;
  mock: boolean;
  repoRoot: string;
  finalReport: string;
  managerDecision?: ManagerDecision;
  verifierReport?: VerifierReport;
  taskPackets: WorkerTaskPacket[];
  workerResults: WorkerResultPacket[];
};

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function createRunId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `run-${stamp}`;
}

export function writeRunnerBundle(orchestratorRoot: string, input: RunnerBundleInput): RunnerManifest {
  const runId = createRunId();
  const runsRoot = path.join(orchestratorRoot, "runs");
  const runDir = path.join(runsRoot, runId);
  const tasksDir = path.join(runDir, "tasks");
  const resultsDir = path.join(runDir, "results");
  const metaDir = path.join(runDir, "meta");
  const reportPath = path.join(runDir, "report.md");
  const summaryPath = path.join(metaDir, "summary.json");

  ensureDir(tasksDir);
  ensureDir(resultsDir);
  ensureDir(metaDir);

  const workers = input.taskPackets.map((packet) => {
    const taskFile = path.join(tasksDir, `${packet.role}.task.json`);
    const resultFile = path.join(resultsDir, `${packet.role}.result.json`);
    const result = input.workerResults.find((item) => item.role === packet.role);

    writeJson(taskFile, packet);
    writeJson(resultFile, result ?? {
      role: packet.role,
      status: "pending",
      changedFiles: [],
      summary: `${packet.role} worker result is missing.`,
      contractsChanged: [],
      verificationRun: [],
      risks: [],
      questions: [],
    });

    return {
      role: packet.role,
      taskFile,
      resultFile,
      status: result?.status ?? "pending",
    };
  });

  const manifest: RunnerManifest = {
    runId,
    createdAt: new Date().toISOString(),
    request: input.request,
    mode: input.mock ? "mock" : "live",
    repoRoot: input.repoRoot,
    runDir,
    tasksDir,
    resultsDir,
    reportPath,
    summaryPath,
    workers,
  };

  fs.writeFileSync(reportPath, input.finalReport, "utf8");
  writeJson(summaryPath, {
    request: input.request,
    managerDecision: input.managerDecision,
    verifierReport: input.verifierReport,
    taskPacketCount: input.taskPackets.length,
    workerResultCount: input.workerResults.length,
  });
  writeJson(path.join(metaDir, "manifest.json"), manifest);

  return manifest;
}

export function readRunnerManifest(orchestratorRoot: string, runId: string): RunnerManifest {
  const manifestPath = path.join(orchestratorRoot, "runs", runId, "meta", "manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as RunnerManifest;
}

export function readWorkerResults(manifest: RunnerManifest): WorkerResultPacket[] {
  return manifest.workers.map((worker) => {
    return JSON.parse(fs.readFileSync(worker.resultFile, "utf8")) as WorkerResultPacket;
  });
}

export function readWorkerTask(manifest: RunnerManifest, role: WorkerTaskPacket["role"]): WorkerTaskPacket {
  const worker = manifest.workers.find((item) => item.role === role);
  if (!worker) {
    throw new Error(`Worker role not found in manifest: ${role}`);
  }

  return JSON.parse(fs.readFileSync(worker.taskFile, "utf8")) as WorkerTaskPacket;
}

export function readWorkerResult(manifest: RunnerManifest, role: WorkerResultPacket["role"]): WorkerResultPacket {
  const worker = manifest.workers.find((item) => item.role === role);
  if (!worker) {
    throw new Error(`Worker role not found in manifest: ${role}`);
  }

  return JSON.parse(fs.readFileSync(worker.resultFile, "utf8")) as WorkerResultPacket;
}

export function writeWorkerResult(manifest: RunnerManifest, result: WorkerResultPacket) {
  const worker = manifest.workers.find((item) => item.role === result.role);
  if (!worker) {
    throw new Error(`Worker role not found in manifest: ${result.role}`);
  }

  writeJson(worker.resultFile, result);
}
