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

function hasContractChanges(results: WorkerResultPacket[], roles: WorkerTaskPacket["role"][]) {
  const roleSet = new Set(roles);
  return results.some((result) => roleSet.has(result.role) && result.contractsChanged.length > 0);
}

function hasOpenQuestions(results: WorkerResultPacket[], roles: WorkerTaskPacket["role"][]) {
  const roleSet = new Set(roles);
  return results.some((result) => roleSet.has(result.role) && result.questions.length > 0);
}

function buildApprovalFlags(results: WorkerResultPacket[], roles: WorkerTaskPacket["role"][]) {
  const flags: string[] = [];
  if (hasOpenQuestions(results, roles)) {
    flags.push("--approve-open-questions");
  }
  if (hasContractChanges(results, roles)) {
    flags.push("--approve-contract-changes");
  }
  return flags.join(" ");
}

function buildContinueAdvice(runId: string, results: WorkerResultPacket[]) {
  const blockedRoles = getBlockedRoles(results);
  const failedRoles = getFailedRoles(results);
  const editableSucceededRoles = getEditableSucceededRoles(results);
  const reviewOnlyRoles = getReviewOnlyRoles(results);
  const lines: string[] = [];

  if (blockedRoles.length > 0) {
    const approvalFlags = buildApprovalFlags(results, blockedRoles);
    lines.push("Status: blocked");
    lines.push("This run reached a safety gate. Do not apply until you decide how to handle the question or contract change.");
    lines.push("Option A - inspect details first:");
    lines.push(`  npm run runner:status -- ${runId}`);
    lines.push("Option B - approve and continue with the existing proposed edits:");
    lines.push(`  npm run runner:reuse-apply -- ${runId} --roles ${formatRoles(blockedRoles)}${approvalFlags ? ` ${approvalFlags}` : ""}`);
    lines.push("Option C - do not approve; create a safer new plan:");
    lines.push('  npm run runner:plan -- --roles <roles> "<revised request>"');
    return lines;
  }

  if (failedRoles.length > 0) {
    lines.push("Status: failed");
    lines.push("Something failed outside the normal safety-gate flow.");
    lines.push("Option A - inspect the failure first:");
    lines.push(`  npm run runner:status -- ${runId}`);
    lines.push("Option B - retry apply without another worker call if proposed edits exist:");
    lines.push(`  npm run runner:reuse-apply -- ${runId} --roles ${formatRoles(failedRoles)}`);
    lines.push("Option C - if the proposed edits look wrong, start a new plan with a narrower request.");
    return lines;
  }

  if (editableSucceededRoles.length > 0) {
    lines.push("Status: ready for apply rehearsal");
    lines.push("Worker proposed edits are available. Reuse them to avoid another worker call.");
    lines.push("Option A - safe rehearsal with rollback:");
    lines.push(`  npm run runner:reuse-apply -- ${runId} --roles ${formatRoles(editableSucceededRoles)}`);
    lines.push("Option B - keep the same proposed edits intentionally:");
    lines.push(`  npm run runner:workflow -- ${runId} --compact --roles ${formatRoles(editableSucceededRoles)} --reuse-worker-results --apply-provider openai --apply --keep-applied --concurrency 1 --continue-on-error`);
    lines.push("Option C - if the plan is not right, start a new request instead of approving this run.");
    return lines;
  }

  if (reviewOnlyRoles.length > 0) {
    lines.push("Status: review complete");
    lines.push("No editable proposed changes were found.");
    lines.push("Option A - review the report and treat this run as complete.");
    lines.push("Option B - start a new request if implementation work is still needed.");
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
    console.log(line);
  }
  console.log("");
  console.log(`Report: ${manifest.reportPath}`);
  console.log(`HTML report: ${path.join(manifest.runDir, "report.html")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
