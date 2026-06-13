import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRunnerManifest, readWorkerResults } from "./packetStore.js";
import {
  getBlockedReasons,
  getBlockedRoles,
  getFailedRoles,
  countDisplayStatuses,
} from "./resultClassification.js";
import type { WorkerTaskPacket } from "./taskSchemas.js";
import type { WorkerResultPacket } from "./resultSchemas.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv: string[]) {
  const runId = argv.join(" ").trim();
  if (!runId) {
    throw new Error("Usage: npm run runner:continue -- <run-id>");
  }
  return { runId };
}

function formatStatusCounts(statusCounts: Record<string, number>) {
  const preferredOrder = ["succeeded", "skipped", "blocked", "failed", "pending", "running"];
  return preferredOrder
    .filter((status) => statusCounts[status])
    .map((status) => `${status}=${statusCounts[status]}`)
    .join(", ") || "none";
}

function formatRoles(roles: WorkerTaskPacket["role"][]) {
  return roles.join(",");
}

function getEditableSucceededRoles(results: WorkerResultPacket[]) {
  return results
    .filter((result) => result.status === "succeeded" && (result.proposedEdits?.length ?? 0) > 0)
    .map((result) => result.role);
}

function getReviewOnlyRoles(results: WorkerResultPacket[]) {
  return results
    .filter((result) => result.status === "skipped" || (result.status === "succeeded" && (result.proposedEdits?.length ?? 0) === 0))
    .map((result) => result.role);
}

function buildContinueAdvice(runId: string, results: WorkerResultPacket[]) {
  const blockedRoles = getBlockedRoles(results);
  const failedRoles = getFailedRoles(results);
  const editableSucceededRoles = getEditableSucceededRoles(results);
  const reviewOnlyRoles = getReviewOnlyRoles(results);
  const lines: string[] = [];

  if (blockedRoles.length > 0) {
    lines.push("Status: blocked");
    lines.push("Review the questions or contract changes before continuing.");
    lines.push(`Inspect: npm run runner:status -- ${runId}`);
    lines.push(`If acceptable: npm run runner:reuse-apply -- ${runId} --roles ${formatRoles(blockedRoles)} --approve-open-questions`);
    return lines;
  }

  if (failedRoles.length > 0) {
    lines.push("Status: failed");
    lines.push("Open the report and inspect failed worker/apply/verification details before retrying.");
    lines.push(`Inspect: npm run runner:status -- ${runId}`);
    lines.push(`Try reuse if proposed edits exist: npm run runner:reuse-apply -- ${runId} --roles ${formatRoles(failedRoles)}`);
    return lines;
  }

  if (editableSucceededRoles.length > 0) {
    lines.push("Status: ready for apply rehearsal");
    lines.push("Worker proposed edits are available. Reuse them to avoid another worker call.");
    lines.push(`Safe rehearsal: npm run runner:reuse-apply -- ${runId} --roles ${formatRoles(editableSucceededRoles)}`);
    lines.push(`Keep applied intentionally: npm run runner:workflow -- ${runId} --compact --roles ${formatRoles(editableSucceededRoles)} --reuse-worker-results --apply-provider openai --apply --keep-applied --concurrency 1 --continue-on-error`);
    return lines;
  }

  if (reviewOnlyRoles.length > 0) {
    lines.push("Status: review complete");
    lines.push("No editable proposed changes were found. Review the report, then start a new request if more work is needed.");
    return lines;
  }

  lines.push("Status: no actionable worker result");
  lines.push("Run runner:status or inspect the report before continuing.");
  return lines;
}

async function main() {
  const { runId } = parseArgs(process.argv.slice(2));
  const orchestratorRoot = path.resolve(__dirname, "..");
  const manifest = readRunnerManifest(orchestratorRoot, runId);
  const results = readWorkerResults(manifest);
  const statusCounts = countDisplayStatuses(results);
  const blockedReasons = getBlockedReasons(results);

  console.log("# Runner Continue");
  console.log(`Run ID: ${manifest.runId}`);
  console.log(`Request: ${manifest.request}`);
  console.log(`Mode: ${manifest.mode}`);
  console.log(`Workers: ${formatStatusCounts(statusCounts)}`);
  if (blockedReasons.length > 0) {
    console.log("Blocked reasons:");
    for (const reason of blockedReasons) {
      console.log(`- ${reason}`);
    }
  }
  console.log("");
  console.log("## Recommended Next Step");
  for (const line of buildContinueAdvice(manifest.runId, results)) {
    console.log(`- ${line}`);
  }
  console.log("");
  console.log(`Report: ${manifest.reportPath}`);
  console.log(`HTML report: ${path.join(manifest.runDir, "report.html")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
