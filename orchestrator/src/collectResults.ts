import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRunnerManifest, readWorkerResults } from "./packetStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv: string[]) {
  const compact = argv.includes("--compact") || argv.includes("--summary-only");
  const runId = argv.filter((item) => item !== "--compact" && item !== "--summary-only").join(" ").trim();
  if (!runId) {
    throw new Error("Usage: npm run runner:collect -- <run-id> [--compact]");
  }

  return { runId, compact };
}

async function main() {
  const { runId, compact } = parseArgs(process.argv.slice(2));
  const orchestratorRoot = path.resolve(__dirname, "..");
  const manifest = readRunnerManifest(orchestratorRoot, runId);
  const results = readWorkerResults(manifest);

  const statusCounts = results.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`# Worker Result Collection`);
  console.log("");
  console.log(`run_id: ${manifest.runId}`);
  console.log(`request: ${manifest.request}`);
  console.log(`mode: ${manifest.mode}`);
  console.log("");
  console.log("status_counts:");
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status}: ${count}`);
  }
  console.log("");
  console.log("workers:");
  for (const result of results) {
    console.log(`  - role: ${result.role}`);
    console.log(`    status: ${result.status}`);
    if (!compact) {
      console.log(`    summary: ${result.summary}`);
    }
    console.log(`    changed_files: ${result.changedFiles.length}`);
    console.log(`    verification_run: ${result.verificationRun.length}`);
    console.log(`    proposed_edits: ${result.proposedEdits?.length ?? 0}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
