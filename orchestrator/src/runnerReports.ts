import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { estimateApiUsageCost, formatEstimatedUsd, summarizeApiUsage } from "./apiUsage.js";
import { readRunnerManifest, readWorkerResults } from "./packetStore.js";
import { countDisplayStatuses, getBlockedRoles, getDisplayStatus, getFailedRoles } from "./resultClassification.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type RunIndexEntry = {
  runId: string;
  createdAt: string;
  request: string;
  mode: string;
  status: "succeeded" | "blocked" | "failed" | "unknown";
  workers: string;
  changedFiles: number;
  proposedEdits: number;
  totalTokens: number;
  estimatedCostUsd: number;
  reportHtml: string;
  reportMd: string;
};

function parseArgs(argv: string[]) {
  const compact = argv.includes("--compact") || argv.includes("--summary-only");
  return { compact };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatStatusCounts(statusCounts: Record<string, number>) {
  const preferred = ["succeeded", "blocked", "failed", "skipped", "pending", "running"];
  return preferred
    .filter((status) => statusCounts[status])
    .map((status) => `${status}=${statusCounts[status]}`)
    .join(", ") || "none";
}

function determineRunStatus(results: ReturnType<typeof readWorkerResults>): RunIndexEntry["status"] {
  const blocked = getBlockedRoles(results);
  const failed = getFailedRoles(results);
  if (failed.length > 0) {
    return "failed";
  }
  if (blocked.length > 0) {
    return "blocked";
  }
  if (results.some((result) => getDisplayStatus(result) === "succeeded")) {
    return "succeeded";
  }
  return "unknown";
}

function collectRuns(orchestratorRoot: string) {
  const runsRoot = path.join(orchestratorRoot, "runs");
  if (!fs.existsSync(runsRoot)) {
    return [];
  }

  return fs.readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^run-\d{4}-/.test(entry.name))
    .map((entry): RunIndexEntry | undefined => {
      try {
        const manifest = readRunnerManifest(orchestratorRoot, entry.name);
        const results = readWorkerResults(manifest);
        const apiUsage = summarizeApiUsage(manifest);
        const apiCost = estimateApiUsageCost(apiUsage);
        const statusCounts = countDisplayStatuses(results);
        return {
          runId: manifest.runId,
          createdAt: manifest.createdAt,
          request: manifest.request,
          mode: manifest.mode,
          status: determineRunStatus(results),
          workers: formatStatusCounts(statusCounts),
          changedFiles: results.reduce((sum, result) => sum + result.changedFiles.length, 0),
          proposedEdits: results.reduce((sum, result) => sum + (result.proposedEdits?.length ?? 0), 0),
          totalTokens: apiUsage.totalTokens,
          estimatedCostUsd: apiCost.estimatedUsd,
          reportHtml: `${entry.name}/report.html`,
          reportMd: `${entry.name}/report.md`,
        };
      } catch {
        return undefined;
      }
    })
    .filter((entry): entry is RunIndexEntry => entry !== undefined)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function renderRunRows(entries: RunIndexEntry[]) {
  if (entries.length === 0) {
    return `<tr><td colspan="9">No runs found.</td></tr>`;
  }

  return entries.map((entry) => [
    `<tr class="status-${escapeHtml(entry.status)}">`,
    `<td><a href="${escapeHtml(entry.reportHtml)}">${escapeHtml(entry.runId)}</a></td>`,
    `<td><span class="pill">${escapeHtml(entry.status)}</span></td>`,
    `<td>${escapeHtml(entry.mode)}</td>`,
    `<td>${escapeHtml(entry.request)}</td>`,
    `<td>${escapeHtml(entry.workers)}</td>`,
    `<td>${entry.proposedEdits}</td>`,
    `<td>${entry.totalTokens}</td>`,
    `<td>${escapeHtml(formatEstimatedUsd(entry.estimatedCostUsd))}</td>`,
    `<td><a href="${escapeHtml(entry.reportMd)}">md</a></td>`,
    `</tr>`,
  ].join("")).join("\n");
}

function renderIndex(entries: RunIndexEntry[]) {
  const statusCounts = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.status] = (acc[entry.status] ?? 0) + 1;
    return acc;
  }, {});
  const totalTokens = entries.reduce((sum, entry) => sum + entry.totalTokens, 0);
  const estimatedCostUsd = entries.reduce((sum, entry) => sum + entry.estimatedCostUsd, 0);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Orchestrator Run Index</title>
  <style>
    :root {
      --ink: #17211b;
      --muted: #637166;
      --paper: #f8f4ea;
      --panel: rgba(255, 253, 247, 0.9);
      --line: rgba(38, 52, 43, 0.16);
      --green: #2f7d4f;
      --amber: #b7791f;
      --red: #b53b3b;
      --blue: #2d5f88;
      --shadow: 0 24px 80px rgba(36, 45, 38, 0.14);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Pretendard", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 20% 0%, rgba(47, 125, 79, 0.18), transparent 34rem),
        linear-gradient(135deg, #f9f5eb, #e9efe2 52%, #f7efe0);
      min-height: 100vh;
    }
    main { width: min(1240px, calc(100vw - 32px)); margin: 0 auto; padding: 44px 0; }
    header, .card, .table-wrap {
      border: 1px solid var(--line);
      border-radius: 26px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }
    header { padding: 32px; }
    h1 { margin: 10px 0; font-size: clamp(32px, 5vw, 56px); letter-spacing: -0.055em; }
    p { color: var(--muted); line-height: 1.65; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin: 22px 0; }
    .card { padding: 18px; }
    .card span { display: block; color: var(--muted); text-transform: uppercase; font-size: 12px; letter-spacing: 0.08em; }
    .card strong { display: block; margin-top: 8px; font-size: 32px; }
    .table-wrap { overflow: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 920px; }
    th, td { padding: 13px 14px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    a { color: var(--blue); font-weight: 700; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .pill { display: inline-flex; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,0.58); }
    .status-succeeded .pill { color: var(--green); }
    .status-blocked .pill { color: var(--amber); }
    .status-failed .pill { color: var(--red); }
    .status-unknown .pill { color: var(--muted); }
    @media (max-width: 640px) {
      main { width: min(100vw - 20px, 1240px); padding: 20px 0; }
      header { padding: 22px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <span class="pill">Orchestrator Runs</span>
      <h1>Run Index</h1>
      <p>Recent orchestration reports collected from <code>orchestrator/runs</code>.</p>
    </header>
    <section class="grid">
      <article class="card"><span>runs</span><strong>${entries.length}</strong></article>
      <article class="card status-succeeded"><span>succeeded</span><strong>${statusCounts.succeeded ?? 0}</strong></article>
      <article class="card status-blocked"><span>blocked</span><strong>${statusCounts.blocked ?? 0}</strong></article>
      <article class="card status-failed"><span>failed</span><strong>${statusCounts.failed ?? 0}</strong></article>
      <article class="card"><span>tokens</span><strong>${totalTokens}</strong></article>
      <article class="card"><span>estimated cost</span><strong>${escapeHtml(formatEstimatedUsd(estimatedCostUsd))}</strong></article>
    </section>
    <section class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>run</th>
            <th>status</th>
            <th>mode</th>
            <th>request</th>
            <th>workers</th>
            <th>edits</th>
            <th>tokens</th>
            <th>cost</th>
            <th>report</th>
          </tr>
        </thead>
        <tbody>
          ${renderRunRows(entries)}
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>
`;
}

function main() {
  const { compact } = parseArgs(process.argv.slice(2));
  const orchestratorRoot = path.resolve(__dirname, "..");
  const runsRoot = path.join(orchestratorRoot, "runs");
  fs.mkdirSync(runsRoot, { recursive: true });
  const entries = collectRuns(orchestratorRoot);
  const indexPath = path.join(runsRoot, "index.html");
  fs.writeFileSync(indexPath, renderIndex(entries), "utf8");

  if (compact) {
    console.log(`runner:reports: runs=${entries.length} index=${indexPath}`);
    return;
  }

  console.log("# Runner Reports");
  console.log(`Runs indexed: ${entries.length}`);
  console.log(`Index: ${indexPath}`);
}

main();
