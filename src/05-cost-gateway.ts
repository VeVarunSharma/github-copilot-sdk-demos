import "dotenv/config";
import { CopilotClient } from "@github/copilot-sdk";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";
import {
  actualAiUnits,
  createUsageTotals,
  estimateCost,
  evaluateApproval,
  findCheaperModel,
  findSelectedModel,
  isConfirmationApproved,
  isOverrideApproved,
  loadGatewayConfig,
} from "./cost-gateway.js";

const prompt =
  process.argv.slice(2).join(" ").trim() ||
  "Explain the value of a cost-aware AI gateway in three concise bullets.";
const config = loadGatewayConfig();
const client = new CopilotClient({
  mode: "empty",
  baseDirectory: resolve(".copilot-demo"),
});

try {
  await client.start();
  const models = await client.listModels();
  const model = findSelectedModel(models, config.model);
  const estimate = estimateCost(prompt, model, config);
  const decision = evaluateApproval(estimate.estimatedAiUnits, config);
  const cheaperModel = findCheaperModel(models, model.id, prompt, config);

  printPreflight(estimate, decision.reason, config.usdPerAiUnit);

  if (
    cheaperModel &&
    cheaperModel.estimatedAiUnits < estimate.estimatedAiUnits
  ) {
    console.log(
      `Optimization: ${cheaperModel.modelId} is estimated at ${formatAiUnits(cheaperModel.estimatedAiUnits)} AI units (${formatUsd(cheaperModel.estimatedUsd)}).`,
    );
  }

  console.log(
    "Optimization: reduce attachments/context or lower GATEWAY_EXPECTED_OUTPUT_TOKENS to reduce the conservative estimate.",
  );

  const approved = await requestApproval(decision.kind, decision.overrideAllowed);
  if (!approved) {
    console.error("Request was not approved. No Copilot session or model request was created.");
    process.exitCode = 2;
  } else {
    const usage = createUsageTotals();
    const session = await client.createSession({
      model: model.id,
      availableTools: [],
      infiniteSessions: { enabled: false },
    });

    try {
      session.on("assistant.usage", (event) => {
        usage.modelCalls += 1;
        usage.inputTokens += event.data.inputTokens ?? 0;
        usage.outputTokens += event.data.outputTokens ?? 0;
        usage.cacheReadTokens += event.data.cacheReadTokens ?? 0;
        usage.cacheWriteTokens += event.data.cacheWriteTokens ?? 0;
        usage.totalNanoAiu += event.data.copilotUsage?.totalNanoAiu ?? 0;
        usage.multiplierCost += event.data.cost ?? 0;
      });

      const response = await session.sendAndWait({ prompt });
      if (!response) {
        throw new Error("The approved session completed without an assistant response.");
      }

      console.log("\nAssistant response:\n");
      console.log(response.data.content);
      printReconciliation(estimate.estimatedAiUnits, config.usdPerAiUnit, usage);
    } finally {
      await session.disconnect();
    }
  }
} finally {
  await client.stop();
}

function printPreflight(
  estimate: ReturnType<typeof estimateCost>,
  decisionReason: string,
  usdPerAiUnit: number,
): void {
  console.log("AI gateway preflight");
  console.log(`Model: ${estimate.modelId}`);
  console.log(
    `Token budget: ~${estimate.estimatedInputTokens} input + ${estimate.estimatedOutputTokens} output`,
  );
  console.log(
    `Estimated cost: ${formatAiUnits(estimate.estimatedAiUnits)} AI units (${formatUsd(estimate.estimatedAiUnits * usdPerAiUnit)})`,
  );
  console.log(`Pricing basis: ${estimate.pricingMode}; confidence: ${estimate.confidence}`);
  console.log(`Policy: ${decisionReason}`);
  console.log(`Caveat: ${estimate.caveat}`);
}

async function requestApproval(
  decision: "allow" | "confirm" | "reject",
  overrideAllowed: boolean,
): Promise<boolean> {
  if (decision === "allow") {
    console.log("Decision: auto-approved.");
    return true;
  }

  if (decision === "reject" && !overrideAllowed) {
    console.error("Decision: rejected by the configured request budget; overrides are disabled.");
    return false;
  }

  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Human approval is required, but stdin/stdout is not an interactive terminal.");
  }

  const readline = createInterface({ input: stdin, output: stdout });
  try {
    if (decision === "confirm") {
      const answer = await readline.question("Approve this request? [y/N] ");
      return isConfirmationApproved(answer);
    }

    console.error('Decision: rejected by threshold. Type "OVERRIDE COST" to execute anyway.');
    const answer = await readline.question("> ");
    return isOverrideApproved(answer);
  } finally {
    readline.close();
  }
}

function printReconciliation(
  estimatedAiUnits: number,
  usdPerAiUnit: number,
  usage: ReturnType<typeof createUsageTotals>,
): void {
  console.log("\nUsage reconciliation");
  console.log(
    `Observed tokens: ${usage.inputTokens} input, ${usage.outputTokens} output, ${usage.cacheReadTokens} cache-read, ${usage.cacheWriteTokens} cache-write across ${usage.modelCalls} model call(s).`,
  );

  const actual = actualAiUnits(usage);
  if (actual.value === undefined) {
    console.log("Actual AI-unit cost: unavailable; no billable usage value was emitted.");
    return;
  }

  const variance = actual.value - estimatedAiUnits;
  console.log(
    `Actual cost: ${formatAiUnits(actual.value)} AI units (${formatUsd(actual.value * usdPerAiUnit)}) from ${actual.source}.`,
  );
  console.log(
    `Variance: ${variance >= 0 ? "+" : ""}${formatAiUnits(variance)} AI units versus preflight.`,
  );
}

function formatAiUnits(value: number): string {
  return value.toFixed(4);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);
}
