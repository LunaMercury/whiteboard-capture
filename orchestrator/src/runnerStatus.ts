import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRunnerManifest, readWorkerResults } from "./packetStore.js";
import {
  getBlockedReasons,
  getBlockedRoles,
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
  const blockedReasons = getBlockedReasons(results);

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
    console.log("Review the questions and contracts before intentionally re-running with approval flags.");
    console.log(
      `npm run runner:workflow -- ${manifest.runId} --roles ${blockedRoles.join(",")} --reuse-worker-results --apply --rollback-after-verify --approve-open-questions`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
