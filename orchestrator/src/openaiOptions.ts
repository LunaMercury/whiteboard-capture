export type OpenAIReasoningEffort = "minimal" | "low" | "medium" | "high";

const reasoningEfforts = new Set(["minimal", "low", "medium", "high"]);

export function parseOpenAIReasoningEffort(value: string | undefined, label: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "none") {
    return undefined;
  }

  if (!reasoningEfforts.has(normalized)) {
    throw new Error(`${label} must be one of: minimal, low, medium, high, none.`);
  }

  return normalized as OpenAIReasoningEffort;
}

export function openAIReasoningRequestPart(effort: OpenAIReasoningEffort | undefined) {
  return effort ? { reasoning: { effort } } : {};
}
