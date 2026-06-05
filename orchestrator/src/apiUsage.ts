import fs from "node:fs";
import path from "node:path";
import type { RunnerManifest } from "./packetStore.js";

export type ApiUsageStage = "worker" | "apply";

export type ApiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  raw: unknown;
};

export type ApiUsageRecord = {
  runId: string;
  recordedAt: string;
  stage: ApiUsageStage;
  role: string;
  provider: "openai";
  model: string;
  usage: ApiUsage;
};

export type ApiUsageSummary = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  records: ApiUsageRecord[];
};

function usageFilePath(manifest: RunnerManifest) {
  return path.join(manifest.runDir, "meta", "api-usage.json");
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function extractOpenAIUsage(payload: unknown): ApiUsage | undefined {
  const usage = (payload as { usage?: Record<string, unknown> })?.usage;
  if (!usage || typeof usage !== "object") {
    return undefined;
  }

  const inputTokens = toNumber(usage.input_tokens);
  const outputTokens = toNumber(usage.output_tokens);
  const totalTokens = toNumber(usage.total_tokens) || inputTokens + outputTokens;

  if (inputTokens === 0 && outputTokens === 0 && totalTokens === 0) {
    return undefined;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    raw: usage,
  };
}

export function readApiUsageRecords(manifest: RunnerManifest): ApiUsageRecord[] {
  const filePath = usageFilePath(manifest);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as { records?: ApiUsageRecord[] };
  return Array.isArray(parsed.records) ? parsed.records : [];
}

export function appendApiUsageRecord(manifest: RunnerManifest, record: Omit<ApiUsageRecord, "runId" | "recordedAt">) {
  const records = readApiUsageRecords(manifest);
  records.push({
    ...record,
    runId: manifest.runId,
    recordedAt: new Date().toISOString(),
  });

  const filePath = usageFilePath(manifest);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify({ records }, null, 2)}\n`, "utf8");
}

export function summarizeApiUsage(manifest: RunnerManifest): ApiUsageSummary {
  const records = readApiUsageRecords(manifest);
  return {
    calls: records.length,
    inputTokens: records.reduce((sum, record) => sum + record.usage.inputTokens, 0),
    outputTokens: records.reduce((sum, record) => sum + record.usage.outputTokens, 0),
    totalTokens: records.reduce((sum, record) => sum + record.usage.totalTokens, 0),
    records,
  };
}
