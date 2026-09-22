import assert from "node:assert/strict";
import test from "node:test";
import type { ModelInfo } from "@github/copilot-sdk";
import {
  actualAiUnits,
  estimateCost,
  estimateTextTokens,
  evaluateApproval,
  findCheaperModel,
  isConfirmationApproved,
  isOverrideApproved,
  loadGatewayConfig,
} from "./cost-gateway.js";

const baseModel: ModelInfo = {
  id: "model-a",
  name: "Model A",
  capabilities: {
    supports: { vision: false, reasoningEffort: false },
    limits: {
      max_prompt_tokens: 10_000,
      max_output_tokens: 4_000,
      max_context_window_tokens: 14_000,
    },
  },
  billing: {
    multiplier: 2,
    tokenPrices: {
      inputPrice: 0.25,
      outputPrice: 1,
      batchSize: 1_000,
      maxPromptTokens: 10_000,
    },
  },
};

const config = {
  model: baseModel.id,
  expectedOutputTokens: 800,
  usdPerAiUnit: 0.02,
  autoApproveMaxAiUnits: 1,
  rejectAboveAiUnits: 5,
  inputOverheadTokens: 800,
  uncertaintyMultiplier: 1.25,
};

test("estimates UTF-8 text conservatively", () => {
  assert.equal(estimateTextTokens(""), 0);
  assert.equal(estimateTextTokens("hello"), 2);
  assert.equal(estimateTextTokens("😀"), 2);
});

test("calculates token-batch AI units and USD", () => {
  const estimate = estimateCost("hello", baseModel, config);

  assert.equal(estimate.pricingMode, "token-prices");
  assert.equal(estimate.estimatedInputTokens, 1003);
  assert.equal(estimate.estimatedOutputTokens, 800);
  assert.equal(estimate.estimatedAiUnits, 1.05075);
  assert.ok(Math.abs(estimate.estimatedUsd - 0.021015) < Number.EPSILON);
});

test("falls back to a request multiplier", () => {
  const model = { ...baseModel, billing: { multiplier: 2.5 } };
  const estimate = estimateCost("hello", model, config);

  assert.equal(estimate.pricingMode, "request-multiplier");
  assert.equal(estimate.estimatedAiUnits, 2.5);
  assert.equal(estimate.confidence, "low");
});

test("fails when pricing metadata is unavailable", () => {
  const { billing: _billing, ...modelWithoutBilling } = baseModel;

  assert.throws(
    () => estimateCost("hello", modelWithoutBilling, config),
    /does not expose usable SDK billing metadata/,
  );
});

test("applies policy boundaries and hard request budgets", () => {
  assert.equal(evaluateApproval(1, config).kind, "allow");
  assert.equal(evaluateApproval(1.0001, config).kind, "confirm");
  assert.equal(evaluateApproval(5, config).kind, "confirm");

  const highCost = evaluateApproval(5.0001, config);
  assert.equal(highCost.kind, "reject");
  assert.equal(highCost.overrideAllowed, true);

  const overBudget = evaluateApproval(3, { ...config, maxRequestAiUnits: 2 });
  assert.equal(overBudget.kind, "reject");
  assert.equal(overBudget.overrideAllowed, false);
});

test("selects the least expensive compatible model", () => {
  const cheaper: ModelInfo = {
    ...baseModel,
    id: "model-b",
    name: "Model B",
    billing: {
      tokenPrices: {
        inputPrice: 0.1,
        outputPrice: 0.5,
        batchSize: 1_000,
        maxPromptTokens: 10_000,
      },
    },
  };
  const expensive: ModelInfo = {
    ...baseModel,
    id: "model-c",
    name: "Model C",
    billing: { multiplier: 4 },
  };

  assert.equal(
    findCheaperModel([baseModel, expensive, cheaper], baseModel.id, "hello", config)?.modelId,
    cheaper.id,
  );
});

test("requires explicit confirmation and override phrases", () => {
  assert.equal(isConfirmationApproved("yes"), true);
  assert.equal(isConfirmationApproved("Y"), true);
  assert.equal(isConfirmationApproved("sure"), false);
  assert.equal(isOverrideApproved("OVERRIDE COST"), true);
  assert.equal(isOverrideApproved("override cost"), false);
});

test("loads and validates environment configuration", () => {
  const loaded = loadGatewayConfig({
    GATEWAY_MODEL: "model-a",
    GATEWAY_USD_PER_AI_UNIT: "0.02",
  });

  assert.equal(loaded.autoApproveMaxAiUnits, 1);
  assert.equal(loaded.rejectAboveAiUnits, 5);
  assert.throws(
    () =>
      loadGatewayConfig({
        GATEWAY_MODEL: "auto",
        GATEWAY_USD_PER_AI_UNIT: "0.02",
      }),
    /explicit GitHub-hosted model/,
  );
  assert.throws(
    () =>
      loadGatewayConfig({
        GATEWAY_MODEL: "model-a",
        GATEWAY_USD_PER_AI_UNIT: "0.02",
        GATEWAY_AUTO_APPROVE_MAX_AIU: "6",
        GATEWAY_REJECT_ABOVE_AIU: "5",
      }),
    /cannot exceed/,
  );
});

test("prefers authoritative Copilot usage over multiplier cost", () => {
  assert.deepEqual(
    actualAiUnits({
      modelCalls: 1,
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalNanoAiu: 1_500_000_000,
      multiplierCost: 9,
    }),
    { value: 1.5, source: "copilot-usage" },
  );
});
