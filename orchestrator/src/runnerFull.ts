import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Args = {
  mock: boolean;
  request: string;
  workflowArgs: string[];
};

const workflowFlagsWithValue = new Set([
  "--worker-provider",
  "--apply-provider",
  "--roles",
]);

const workflowBooleanFlags = new Set([
  "--apply",
  "--allow-dirty",
  "--apply-review",
  "--continue-on-error",
  "--skip-workers",
  "--skip-finalize",
]);

function parseArgs(argv: string[]): Args {
  const workflowArgs: string[] = [];
  const requestParts: string[] = [];
  let mock = false;

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (item === "--mock") {
      mock = true;
      continue;
    }

    if (workflowFlagsWithValue.has(item)) {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`Missing value for ${item}`);
      }
      workflowArgs.push(item, value);
      index += 1;
      continue;
    }

    if (workflowBooleanFlags.has(item)) {
      workflowArgs.push(item);
      continue;
    }

    requestParts.push(item);
  }

  const request = requestParts.join(" ").trim();
  if (!request) {
    throw new Error(
      "Usage: npm run runner:full -- [--mock] [--roles frontend,java] [--worker-provider openai|manual|claude] [--apply-provider openai|manual] [--apply] \"request\"",
    );
  }

  return {
    mock,
    request,
    workflowArgs,
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

function extractRunId(output: string) {
  const match = output.match(/^Run ID:\s*(run-[^\r\n]+)/m);
  return match?.[1]?.trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const orchestratorRoot = path.resolve(__dirname, "..");

  console.log("# Runner Full");
  console.log(`Request: ${args.request}`);
  console.log(`Mode: ${args.mock ? "mock" : "live"}`);
  console.log(`Workflow args: ${args.workflowArgs.join(" ") || "none"}`);
  console.log("");

  const prepareArgs = [...(args.mock ? ["--mock"] : []), args.request];
  const prepare = runNodeScript(path.join("src", "prepareRunner.ts"), prepareArgs, orchestratorRoot);
  printChildOutput(prepare, "runner:prepare");

  if (prepare.status !== 0) {
    process.exit(prepare.status ?? 1);
  }

  const runId = extractRunId(prepare.stdout ?? "");
  if (!runId) {
    throw new Error("Could not extract run ID from runner:prepare output.");
  }

  console.log("");
  console.log("## Running workflow");
  const workflow = runNodeScript(
    path.join("src", "runnerWorkflow.ts"),
    [runId, ...args.workflowArgs],
    orchestratorRoot,
  );
  printChildOutput(workflow, "runner:workflow");

  if (workflow.status !== 0) {
    process.exit(workflow.status ?? 1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
