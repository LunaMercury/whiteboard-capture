import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRunnerManifest, readWorkerResults } from "./packetStore.js";
import {
  getBlockedReasons,
  getBlockedRoles,
  getFailedRoles,
  getDisplayStatus,
} from "./resultClassification.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv: string[]) {
  const runId = argv.join(" ").trim();
  return { runId };
}

async function main() {
  const { runId } = parseArgs(process.argv.slice(2));
  if (!runId) {
    throw new Error("Usage: npm run runner:status -- <run-id>");
  }

  const orchestratorRoot = path.resolve(__dirname, "..");
  const manifest = readRunnerManifest(orchestratorRoot, runId);
  const results = readWorkerResults(manifest);
  const blockedRoles = getBlockedRoles(results);
  const failedRoles = getFailedRoles(results);
  const blockedReasons = getBlockedReasons(results);
  const editableResults = results.filter((result) => result.status === "succeeded" && (result.proposedEdits?.length ?? 0) > 0);

  console.log(`# Runner Status`);
  console.log("");
  console.log(`Run ID: ${manifest.runId}`);
  console.log(`Request: ${manifest.request}`);
  console.log(`Mode: ${manifest.mode}`);
  console.log("");
  console.log(`## Workers`);

  for (const worker of manifest.workers) {
    const result = results.find((item) => item.role === worker.role);
    console.log(`- ${worker.role}: ${result ? getDisplayStatus(result) : worker.status}`);
    console.log(`  task: ${worker.taskFile}`);
    console.log(`  result: ${worker.resultFile}`);
    console.log(`  summary: ${result?.summary ?? "no summary"}`);
    if (result?.questions.length) {
      console.log("  questions:");
      for (const question of result.questions) {
        console.log(`    - ${question}`);
      }
    }
  }

  if (blockedRoles.length > 0) {
    console.log("");
    console.log("## Blocked");
    console.log(`Roles: ${blockedRoles.join(", ")}`);
    console.log("Reasons:");
    for (const reason of blockedReasons) {
      console.log(`- ${reason}`);
    }
    console.log("");
    console.log("Review the questions and contracts before intentionally continuing.");
  }

  console.log("");
  console.log("## Continue Chain");
  console.log(`Inspect options: npm run runner:continue -- ${manifest.runId}`);
  if (blockedRoles.length > 0) {
    console.log(`Preview approval path: npm run runner:continue:b -- ${manifest.runId}`);
    console.log(`Execute approval rehearsal: npm run runner:continue:b:execute -- ${manifest.runId}`);
    console.log(`Reject this plan: npm run runner:continue:c -- ${manifest.runId}`);
  } else if (failedRoles.length > 0) {
    console.log(`Inspect failure details first: npm run runner:continue:a -- ${manifest.runId}`);
    console.log(`Retry reusable apply path when available: npm run runner:continue:b:execute -- ${manifest.runId}`);
    console.log(`Reject this plan: npm run runner:continue:c -- ${manifest.runId}`);
  } else if (editableResults.length > 0) {
    console.log(`Safe rehearsal with rollback: npm run runner:continue:a:execute -- ${manifest.runId}`);
    console.log(`Preview keep-applied path: npm run runner:continue:b -- ${manifest.runId}`);
    console.log(`Keep applied intentionally: npm run runner:continue:b:execute -- ${manifest.runId}`);
    console.log(`Reject this plan: npm run runner:continue:c -- ${manifest.runId}`);
  } else {
    console.log("No editable proposed changes were found. Review the report or start a new request if implementation is still needed.");
  }

  console.log("");
  console.log(`Report: ${manifest.reportPath}`);
  console.log(`HTML report: ${path.join(manifest.runDir, "report.html")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
