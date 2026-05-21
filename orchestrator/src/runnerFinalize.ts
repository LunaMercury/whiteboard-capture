import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readRunnerManifest,
  readRunnerSummary,
  readWorkerResults,
  writeRunnerManifest,
  writeRunnerReport,
  writeRunnerSummary,
} from "./packetStore.js";
import type { WorkerResultPacket } from "./resultSchemas.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv: string[]) {
  const runId = argv.join(" ").trim();
  if (!runId) {
    throw new Error("Usage: npm run runner:finalize -- <run-id>");
  }
  return { runId };
}

function countStatuses(results: WorkerResultPacket[]) {
  return results.reduce<Record<string, number>>((acc, result) => {
    acc[result.status] = (acc[result.status] ?? 0) + 1;
    return acc;
  }, {});
}

function buildReleaseBlockers(results: WorkerResultPacket[]) {
  const blockers: string[] = [];

  for (const result of results.filter((item) => item.status === "failed")) {
    blockers.push(`${result.role} worker failed: ${result.summary}`);
  }
  for (const result of results.filter((item) => item.status === "pending")) {
    blockers.push(`${result.role} worker has not been executed yet.`);
  }
  for (const result of results.filter((item) => item.status === "running")) {
    blockers.push(`${result.role} worker is still marked as running.`);
  }

  return blockers;
}

function buildFindings(results: WorkerResultPacket[]) {
  return results.map((result) => {
    const changed = result.changedFiles.length;
    const proposed = result.proposedEdits?.length ?? 0;
    const verification = result.verificationRun.length;
    return `${result.role}: status=${result.status}, changed_files=${changed}, proposed_edits=${proposed}, verification=${verification}`;
  });
}

function buildRecommendedVerification(results: WorkerResultPacket[]) {
  return Array.from(new Set(results.flatMap((result) => result.verificationRun)));
}

function buildFinalSummary(results: WorkerResultPacket[]) {
  const succeeded = results.filter((result) => result.status === "succeeded").map((result) => result.role);
  const running = results.filter((result) => result.status === "running").map((result) => result.role);
  const pending = results.filter((result) => result.status === "pending").map((result) => result.role);
  const failed = results.filter((result) => result.status === "failed").map((result) => result.role);

  const parts: string[] = [];
  if (succeeded.length > 0) {
    parts.push(`Succeeded: ${succeeded.join(", ")}`);
  }
  if (running.length > 0) {
    parts.push(`Running: ${running.join(", ")}`);
  }
  if (pending.length > 0) {
    parts.push(`Pending: ${pending.join(", ")}`);
  }
  if (failed.length > 0) {
    parts.push(`Failed: ${failed.join(", ")}`);
  }

  return parts.length > 0 ? parts.join(" / ") : "No worker results were collected.";
}

function renderFinalReport(
  request: string,
  mode: string,
  statusCounts: Record<string, number>,
  finalSummary: string,
  results: WorkerResultPacket[],
  releaseBlockers: string[],
  recommendedVerification: string[],
) {
  const lines = [
    "# Finalized Runner Report",
    "",
    `- Request: ${request}`,
    `- Mode: ${mode}`,
    `- Summary: ${finalSummary}`,
    "",
    "## Status Counts",
  ];

  for (const [status, count] of Object.entries(statusCounts)) {
    lines.push(`- ${status}: ${count}`);
  }

  lines.push("");
  lines.push("## Worker Results");
  for (const result of results) {
    lines.push(`### ${result.role}`);
    lines.push(`- status: ${result.status}`);
    lines.push(`- summary: ${result.summary}`);
    lines.push(`- changed_files: ${result.changedFiles.length}`);
    lines.push(`- proposed_edits: ${result.proposedEdits?.length ?? 0}`);
    lines.push(`- verification_run: ${result.verificationRun.length}`);
    if (result.risks.length > 0) {
      lines.push("- risks:");
      for (const risk of result.risks) {
        lines.push(`  - ${risk}`);
      }
    }
  }

  lines.push("");
  lines.push("## Release Blockers");
  if (releaseBlockers.length === 0) {
    lines.push("- none");
  } else {
    for (const blocker of releaseBlockers) {
      lines.push(`- ${blocker}`);
    }
  }

  lines.push("");
  lines.push("## Recommended Verification");
  if (recommendedVerification.length === 0) {
    lines.push("- none");
  } else {
    for (const verification of recommendedVerification) {
      lines.push(`- ${verification}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const { runId } = parseArgs(process.argv.slice(2));
  const orchestratorRoot = path.resolve(__dirname, "..");
  const manifest = readRunnerManifest(orchestratorRoot, runId);
  const summary = readRunnerSummary(manifest);
  const results = readWorkerResults(manifest);

  manifest.workers = manifest.workers.map((worker) => {
    const result = results.find((item) => item.role === worker.role);
    return {
      ...worker,
      status: result?.status ?? worker.status,
    };
  });

  const statusCounts = countStatuses(results);
  const releaseBlockers = buildReleaseBlockers(results);
  const findings = buildFindings(results);
  const recommendedVerification = buildRecommendedVerification(results);
  const finalSummary = buildFinalSummary(results);

  summary.verifierReport = {
    summary: `Finalized worker collection. ${finalSummary}`,
    findings,
    contractChecks: summary.verifierReport?.contractChecks ?? [],
    recommendedVerification,
    releaseBlockers,
  };
  summary.workerResultCount = results.length;

  const report = renderFinalReport(
    summary.request,
    manifest.mode,
    statusCounts,
    finalSummary,
    results,
    releaseBlockers,
    recommendedVerification,
  );

  writeRunnerManifest(orchestratorRoot, manifest);
  writeRunnerSummary(manifest, summary);
  writeRunnerReport(manifest, report);

  console.log("# Runner Finalize");
  console.log(`Run ID: ${runId}`);
  console.log(`Summary: ${finalSummary}`);
  console.log(`Report: ${manifest.reportPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
