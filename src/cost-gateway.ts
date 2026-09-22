import type { ModelInfo } from "@github/copilot-sdk";

const NANO_AIU_PER_AIU = 1_000_000_000;

export interface GatewayConfig {
  model: string;
  expectedOutputTokens: number;
  usdPerAiUnit: number;
  autoApproveMaxAiUnits: number;
  rejectAboveAiUnits: number;
  maxRequestAiUnits?: number;
  inputOverheadTokens: number;
  uncertaintyMultiplier: number;
}

export interface CostEstimate {
  modelId: string;
  pricingMode: "token-prices" | "request-multiplier";
  promptTokens: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedAiUnits: number;
  estimatedUsd: number;
  confidence: "medium" | "low";
  caveat: string;
}

export interface ApprovalDecision {
  kind: "allow" | "confirm" | "reject";
  reason: string;
  overrideAllowed: boolean;
}

export interface UsageTotals {
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalNanoAiu: number;
  multiplierCost: number;
}

export function loadGatewayConfig(
  environment: NodeJS.ProcessEnv = process.env,
): GatewayConfig {
  const model = environment.GATEWAY_MODEL?.trim();

  if (!model || model === "auto") {
    throw new Error('GATEWAY_MODEL must name an explicit GitHub-hosted model; "auto" is not supported.');
  }

  const config: GatewayConfig = {
    model,
    expectedOutputTokens: readNumber(environment, "GATEWAY_EXPECTED_OUTPUT_TOKENS", 800, {
      minimum: 1,
      integer: true,
    }),
    usdPerAiUnit: readNumber(environment, "GATEWAY_USD_PER_AI_UNIT", undefined, {
      minimum: 0,
    }),
    autoApproveMaxAiUnits: readNumber(environment, "GATEWAY_AUTO_APPROVE_MAX_AIU", 1, {
      minimum: 0,
    }),
    rejectAboveAiUnits: readNumber(environment, "GATEWAY_REJECT_ABOVE_AIU", 5, {
      minimum: 0,
    }),
    inputOverheadTokens: readNumber(environment, "GATEWAY_INPUT_OVERHEAD_TOKENS", 800, {
      minimum: 0,
      integer: true,
    }),
    uncertaintyMultiplier: readNumber(environment, "GATEWAY_UNCERTAINTY_MULTIPLIER", 1.25, {
      minimum: 1,
    }),
  };

  const maxRequestValue = environment.GATEWAY_MAX_REQUEST_AIU?.trim();
  if (maxRequestValue) {
    config.maxRequestAiUnits = parseNumber("GATEWAY_MAX_REQUEST_AIU", maxRequestValue, {
      minimum: 0,
    });
  }

  if (config.autoApproveMaxAiUnits > config.rejectAboveAiUnits) {
    throw new Error("GATEWAY_AUTO_APPROVE_MAX_AIU cannot exceed GATEWAY_REJECT_ABOVE_AIU.");
  }

  return config;
}

export function findSelectedModel(models: ModelInfo[], modelId: string): ModelInfo {
  const model = models.find((candidate) => candidate.id === modelId);

  if (!model) {
    throw new Error(`Model "${modelId}" is not available to the authenticated GitHub Copilot account.`);
  }

  if (model.policy?.state === "disabled") {
    throw new Error(`Model "${modelId}" is disabled by policy.`);
  }

  return model;
}

export function estimateTextTokens(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  return Math.ceil(Buffer.byteLength(text, "utf8") / 3);
}

export function estimateCost(
  prompt: string,
  model: ModelInfo,
  config: GatewayConfig,
): CostEstimate {
  const promptTokens = estimateTextTokens(prompt);
  const estimatedInputTokens = Math.ceil(
    (promptTokens + config.inputOverheadTokens) * config.uncertaintyMultiplier,
  );
  const estimatedOutputTokens = config.expectedOutputTokens;
  const maxPromptTokens =
    model.billing?.tokenPrices?.maxPromptTokens ??
    model.capabilities.limits.max_prompt_tokens ??
    model.capabilities.limits.max_context_window_tokens - estimatedOutputTokens;
  const maxOutputTokens = model.capabilities.limits.max_output_tokens;

  if (estimatedInputTokens > maxPromptTokens) {
    throw new Error(
      `Estimated input (${estimatedInputTokens} tokens) exceeds ${model.id}'s prompt limit (${maxPromptTokens}).`,
    );
  }

  if (maxOutputTokens !== undefined && estimatedOutputTokens > maxOutputTokens) {
    throw new Error(
      `Expected output (${estimatedOutputTokens} tokens) exceeds ${model.id}'s output limit (${maxOutputTokens}).`,
    );
  }

  const tokenPrices = model.billing?.tokenPrices;
  if (
    tokenPrices?.batchSize !== undefined &&
    tokenPrices.batchSize > 0 &&
    tokenPrices.inputPrice !== undefined &&
    tokenPrices.outputPrice !== undefined
  ) {
    const estimatedAiUnits =
      (estimatedInputTokens / tokenPrices.batchSize) * tokenPrices.inputPrice +
      (estimatedOutputTokens / tokenPrices.batchSize) * tokenPrices.outputPrice;

    return {
      modelId: model.id,
      pricingMode: "token-prices",
      promptTokens,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedAiUnits,
      estimatedUsd: estimatedAiUnits * config.usdPerAiUnit,
      confidence: "medium",
      caveat:
        "Conservative token-batch estimate; actual system context, caching, reasoning, retries, and output length can change usage.",
    };
  }

  const multiplier = model.billing?.multiplier;
  if (multiplier === undefined || !Number.isFinite(multiplier) || multiplier < 0) {
    throw new Error(`Model "${model.id}" does not expose usable SDK billing metadata.`);
  }

  return {
    modelId: model.id,
    pricingMode: "request-multiplier",
    promptTokens,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedAiUnits: multiplier,
    estimatedUsd: multiplier * config.usdPerAiUnit,
    confidence: "low",
    caveat:
      "Fallback request-multiplier estimate; this model did not expose token-level prices, so prompt and output length are not reflected in the AI-unit estimate.",
  };
}

export function evaluateApproval(
  estimatedAiUnits: number,
  config: GatewayConfig,
): ApprovalDecision {
  if (
    config.maxRequestAiUnits !== undefined &&
    estimatedAiUnits > config.maxRequestAiUnits
  ) {
    return {
      kind: "reject",
      reason: `Estimate exceeds the configured request budget of ${formatNumber(config.maxRequestAiUnits)} AI units.`,
      overrideAllowed: false,
    };
  }

  if (estimatedAiUnits <= config.autoApproveMaxAiUnits) {
    return {
      kind: "allow",
      reason: `Estimate is at or below the ${formatNumber(config.autoApproveMaxAiUnits)} AI-unit auto-approval threshold.`,
      overrideAllowed: false,
    };
  }

  if (estimatedAiUnits <= config.rejectAboveAiUnits) {
    return {
      kind: "confirm",
      reason: `Estimate is above auto-approval and at or below the ${formatNumber(config.rejectAboveAiUnits)} AI-unit rejection threshold.`,
      overrideAllowed: false,
    };
  }

  return {
    kind: "reject",
    reason: `Estimate exceeds the ${formatNumber(config.rejectAboveAiUnits)} AI-unit rejection threshold.`,
    overrideAllowed: true,
  };
}

export function findCheaperModel(
  models: ModelInfo[],
  selectedModelId: string,
  prompt: string,
  config: GatewayConfig,
): CostEstimate | undefined {
  const estimates = models.flatMap((model) => {
    if (model.id === selectedModelId || model.id === "auto" || model.policy?.state === "disabled") {
      return [];
    }

    try {
      return [estimateCost(prompt, model, { ...config, model: model.id })];
    } catch {
      return [];
    }
  });

  return estimates.sort((left, right) => left.estimatedAiUnits - right.estimatedAiUnits)[0];
}

export function createUsageTotals(): UsageTotals {
  return {
    modelCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalNanoAiu: 0,
    multiplierCost: 0,
  };
}

export function actualAiUnits(usage: UsageTotals): {
  value?: number;
  source?: "copilot-usage" | "multiplier-cost";
} {
  if (usage.totalNanoAiu > 0) {
    return { value: usage.totalNanoAiu / NANO_AIU_PER_AIU, source: "copilot-usage" };
  }

  if (usage.multiplierCost > 0) {
    return { value: usage.multiplierCost, source: "multiplier-cost" };
  }

  return {};
}

export function isConfirmationApproved(answer: string): boolean {
  return /^(y|yes)$/i.test(answer.trim());
}

export function isOverrideApproved(answer: string): boolean {
  return answer.trim() === "OVERRIDE COST";
}

function readNumber(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number | undefined,
  options: { minimum: number; integer?: boolean },
): number {
  const value = environment[name]?.trim();

  if (!value) {
    if (fallback === undefined) {
      throw new Error(`${name} is required.`);
    }

    return fallback;
  }

  return parseNumber(name, value, options);
}

function parseNumber(
  name: string,
  value: string,
  options: { minimum: number; integer?: boolean },
): number {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < options.minimum ||
    (options.integer === true && !Number.isInteger(parsed))
  ) {
    const qualifier = options.integer === true ? "an integer" : "a number";
    throw new Error(`${name} must be ${qualifier} greater than or equal to ${options.minimum}.`);
  }

  return parsed;
}

function formatNumber(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, "");
}
