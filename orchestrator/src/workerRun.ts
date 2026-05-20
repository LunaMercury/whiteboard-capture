import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRunnerManifest, readWorkerResult, readWorkerTask, writeWorkerResult } from "./packetStore.js";
import { workerResultPacketSchema, type WorkerResultPacket } from "./resultSchemas.js";
import type { WorkerTaskPacket } from "./taskSchemas.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type SupportedProvider = "claude" | "manual";

type Args = {
  runId: string;
  role: WorkerTaskPacket["role"];
  provider: SupportedProvider;
};

function parseArgs(argv: string[]): Args {
  const providerFlagIndex = argv.findIndex((item) => item === "--provider");
  let provider: SupportedProvider = (process.env.WORKER_PROVIDER as SupportedProvider) || "claude";
  const filtered = [...argv];

  if (providerFlagIndex >= 0) {
    provider = filtered[providerFlagIndex + 1] as SupportedProvider;
    filtered.splice(providerFlagIndex, 2);
  }

  const [runId, role] = filtered;

  if (!runId || !role || !["frontend", "rust", "java", "mobile"].includes(role)) {
    throw new Error("Usage: npm run worker:run -- <run-id> <frontend|rust|java|mobile> [--provider claude|manual]");
  }

  if (!["claude", "manual"].includes(provider)) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return {
    runId,
    role: role as WorkerTaskPacket["role"],
    provider,
  };
}

function createResultJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      role: { type: "string", enum: ["frontend", "rust", "java", "mobile"] },
      status: { type: "string", enum: ["running", "succeeded", "failed", "skipped"] },
      changedFiles: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      contractsChanged: { type: "array", items: { type: "string" } },
      verificationRun: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      questions: { type: "array", items: { type: "string" } },
    },
    required: ["role", "status", "changedFiles", "summary", "contractsChanged", "verificationRun", "risks", "questions"],
  };
}

function renderExecutionPrompt(runId: string, task: WorkerTaskPacket, resultPath: string): string {
  return [
    `You are the ${task.role} worker for the Whiteboard Capture repository.`,
    `Work only inside the allowed paths.`,
    `Do not modify blocked paths.`,
    `If you need a contract change outside your scope, do not edit it. Report it in contractsChanged or questions.`,
    `Run ID: ${runId}`,
    ``,
    `Goal:`,
    task.goal,
    ``,
    `Allowed paths:`,
    ...task.allowedPaths.map((item) => `- ${item}`),
    ``,
    `Blocked paths:`,
    ...task.blockedPaths.map((item) => `- ${item}`),
    ``,
    `Touched areas:`,
    ...task.touchedAreas.map((item) => `- ${item}`),
    ``,
    `Implementation steps:`,
    ...task.implementationSteps.map((item) => `- ${item}`),
    ``,
    `Dependencies:`,
    ...task.dependencies.map((item) => `- ${item}`),
    ``,
    `Contracts:`,
    ...task.contracts.map((item) => `- ${item}`),
    ``,
    `Required verification:`,
    ...task.requiredVerification.map((item) => `- ${item}`),
    ``,
    `Instructions:`,
    `- You may edit files inside allowed paths when necessary.`,
    `- Run relevant verification commands when possible.`,
    `- Return only JSON matching the provided schema.`,
    `- Use changedFiles as repository-relative paths.`,
    `- Use status 'succeeded' only if your scoped work and verification are complete.`,
    `- Use status 'failed' if you were blocked or verification failed.`,
    `- Use status 'skipped' only if no code change was necessary.`,
    `- The runner will write your JSON to: ${resultPath}`,
  ].join("\n");
}

function writeFailureResult(
  role: WorkerTaskPacket["role"],
  resultPath: string,
  summary: string,
  risks: string[],
  questions: string[] = [],
) {
  const result: WorkerResultPacket = {
    role,
    status: "failed",
    changedFiles: [],
    summary,
    contractsChanged: [],
    verificationRun: [],
    risks,
    questions,
  };

  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

async function main() {
  const { runId, role, provider } = parseArgs(process.argv.slice(2));
  const orchestratorRoot = path.resolve(__dirname, "..");
  const manifest = readRunnerManifest(orchestratorRoot, runId);
  const task = readWorkerTask(manifest, role);
  const existingResult = readWorkerResult(manifest, role);
  const workerEntry = manifest.workers.find((item) => item.role === role);

  if (!workerEntry) {
    throw new Error(`Worker entry not found for role: ${role}`);
  }

  const resultPath = workerEntry.resultFile;
  const workersDir = path.join(manifest.runDir, "workers");
  fs.mkdirSync(workersDir, { recursive: true });
  const promptPath = path.join(workersDir, `${role}.prompt.md`);
  fs.writeFileSync(promptPath, `${renderExecutionPrompt(runId, task, resultPath)}\n`, "utf8");

  if (provider === "manual") {
    const manualResult: WorkerResultPacket = {
      ...existingResult,
      status: "running",
      summary: `${role} worker prompt가 준비되었습니다. 수동 실행 후 result.json을 업데이트해야 합니다.`,
      questions: [
        ...existingResult.questions.filter((item) => !item.includes("실행기")),
        "worker prompt를 읽고 수동으로 실행한 뒤 result.json을 갱신하세요.",
      ],
    };
    writeWorkerResult(manifest, manualResult);
    console.log(`# Worker Manual Preparation`);
    console.log(`Run ID: ${runId}`);
    console.log(`Role: ${role}`);
    console.log(`Prompt: ${promptPath}`);
    console.log(`Result: ${resultPath}`);
    return;
  }

  const schema = JSON.stringify(createResultJsonSchema());
  const prompt = renderExecutionPrompt(runId, task, resultPath);
  const command = "claude";
  const args = [
    "--print",
    "--output-format",
    "json",
    "--json-schema",
    schema,
    "--permission-mode",
    "acceptEdits",
    "--add-dir",
    manifest.repoRoot,
    prompt,
  ];

  const child = spawnSync(command, args, {
    cwd: manifest.repoRoot,
    encoding: "utf8",
    timeout: 20 * 60 * 1000,
  });

  if (child.error) {
    writeFailureResult(
      role,
      resultPath,
      `${role} worker CLI 실행에 실패했습니다.`,
      [String(child.error.message)],
      ["claude CLI 설치 또는 인증 상태를 확인하세요."],
    );
    throw child.error;
  }

  if (child.status !== 0) {
    writeFailureResult(
      role,
      resultPath,
      `${role} worker CLI가 비정상 종료되었습니다.`,
      [child.stderr?.trim() || "unknown cli error"],
      ["claude CLI 인증, 권한 모드, 워크스페이스 접근 권한을 확인하세요."],
    );
    throw new Error(child.stderr?.trim() || `CLI exited with code ${child.status}`);
  }

  const parsed = workerResultPacketSchema.safeParse(JSON.parse(child.stdout));
  if (!parsed.success) {
    writeFailureResult(
      role,
      resultPath,
      `${role} worker 결과를 파싱하지 못했습니다.`,
      [parsed.error.message],
      ["CLI 출력이 worker result schema를 따르도록 프롬프트를 조정해야 합니다."],
    );
    throw new Error(parsed.error.message);
  }

  const result: WorkerResultPacket = {
    ...parsed.data,
    role,
  };
  writeWorkerResult(manifest, result);

  console.log(`# Worker Run Complete`);
  console.log(`Run ID: ${runId}`);
  console.log(`Role: ${role}`);
  console.log(`Provider: ${provider}`);
  console.log(`Prompt: ${promptPath}`);
  console.log(`Result: ${resultPath}`);
  console.log(`Status: ${result.status}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
