import { CopilotClient, defineTool } from "@github/copilot-sdk";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const knownServices = ["checkout-api", "catalog-api"] as const;
type KnownService = (typeof knownServices)[number];

type ServiceHealth = {
  status: "healthy" | "degraded" | "recovering";
  errorRatePercent: number;
  p95LatencyMs: number;
  incidentStartedAt: string | null;
  updatedAt: string;
};

type FeatureFlagState = {
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
};

type IncidentLog = {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  traceId: string;
};

const featureFlagInitiallyEnabled =
  process.env.DEMO_PAYMENT_PROVIDER_V2_ENABLED?.trim().toLowerCase() !== "false";

const serviceHealth: Record<KnownService, ServiceHealth> = {
  "checkout-api": featureFlagInitiallyEnabled
    ? {
        status: "degraded",
        errorRatePercent: 8.7,
        p95LatencyMs: 2400,
        incidentStartedAt: "2026-09-22T17:42:00Z",
        updatedAt: "2026-09-22T17:49:00Z",
      }
    : {
        status: "recovering",
        errorRatePercent: 1.1,
        p95LatencyMs: 420,
        incidentStartedAt: "2026-09-22T17:42:00Z",
        updatedAt: "2026-09-22T18:02:00Z",
      },
  "catalog-api": {
    status: "healthy",
    errorRatePercent: 0.2,
    p95LatencyMs: 180,
    incidentStartedAt: null,
    updatedAt: "2026-09-22T17:49:00Z",
  },
};

const deployments = {
  "checkout-api": [
    {
      version: "checkout-api@2026.09.22.3",
      deployedAt: "2026-09-22T17:35:00Z",
      changes: ["Enabled the payment-provider-v2 routing path", "Updated retry timeout from 2s to 5s"],
    },
  ],
  "catalog-api": [
    {
      version: "catalog-api@2026.09.22.1",
      deployedAt: "2026-09-22T12:10:00Z",
      changes: ["Dependency updates only"],
    },
  ],
} as const;

const featureFlags = {
  "checkout-api": {
    "payment-provider-v2": {
      enabled: featureFlagInitiallyEnabled,
      updatedAt: featureFlagInitiallyEnabled
        ? "2026-09-22T17:35:00Z"
        : "2026-09-22T18:01:00Z",
      updatedBy: featureFlagInitiallyEnabled ? "deployment-pipeline" : "incident-commander",
    },
  },
  "catalog-api": {},
} satisfies Record<KnownService, Record<string, FeatureFlagState>>;

const incidentLogs: Record<KnownService, IncidentLog[]> = {
  "checkout-api": [
    {
      timestamp: "2026-09-22T17:42:11Z",
      level: "error",
      message: "payment-provider-v2 request timed out after 5000 ms",
      traceId: "trace-checkout-1042",
    },
    {
      timestamp: "2026-09-22T17:42:12Z",
      level: "warn",
      message: "checkout retry routed to payment-provider-v2",
      traceId: "trace-checkout-1042",
    },
    {
      timestamp: "2026-09-22T17:43:04Z",
      level: "error",
      message: "checkout failed because payment-provider-v2 exhausted retries",
      traceId: "trace-checkout-1049",
    },
  ],
  "catalog-api": [
    {
      timestamp: "2026-09-22T17:43:00Z",
      level: "info",
      message: "catalog request completed successfully",
      traceId: "trace-catalog-2101",
    },
  ],
};

const runbooks = [
  {
    id: "RB-104",
    title: "Checkout latency after payment routing changes",
    summary:
      "Compare the incident start with the latest checkout deployment. If correlated, disable payment-provider-v2 and verify p95 latency and error rate for 10 minutes.",
  },
  {
    id: "RB-210",
    title: "General API error-rate triage",
    summary:
      "Check upstream dependency health, recent deployments, saturation, and request traces before escalating.",
  },
];

function isKnownService(service: string): service is KnownService {
  return knownServices.includes(service as KnownService);
}

function inferTargetService(incident: string): KnownService {
  return knownServices.find((service) => incident.toLowerCase().includes(service)) ?? "checkout-api";
}

const getServiceHealth = defineTool<{ service: string }>("get_service_health", {
  description: "Get current health metrics for a production service.",
  parameters: {
    type: "object",
    properties: {
      service: { type: "string", description: "Service name, such as checkout-api." },
    },
    required: ["service"],
    additionalProperties: false,
  },
  skipPermission: true,
  handler: async ({ service }) => {
    console.error(`[tool] get_service_health service=${service}`);

    if (!isKnownService(service)) {
      return { error: `Unknown service: ${service}`, knownServices };
    }

    return { service, ...serviceHealth[service] };
  },
});

const getRecentDeployments = defineTool<{ service: string }>("get_recent_deployments", {
  description: "Get recent deployments and change summaries for a production service.",
  parameters: {
    type: "object",
    properties: {
      service: { type: "string", description: "Service name, such as checkout-api." },
    },
    required: ["service"],
    additionalProperties: false,
  },
  skipPermission: true,
  handler: async ({ service }) => {
    console.error(`[tool] get_recent_deployments service=${service}`);

    if (!isKnownService(service)) {
      return { error: `Unknown service: ${service}`, knownServices };
    }

    return { service, deployments: deployments[service] };
  },
});

const searchIncidentLogs = defineTool<{ service: string; query: string }>("search_incident_logs", {
  description: "Search recent service logs using keywords that describe an incident symptom.",
  parameters: {
    type: "object",
    properties: {
      service: { type: "string", description: "Service name, such as checkout-api." },
      query: { type: "string", description: "Keywords such as timeout, retries, or payment provider." },
    },
    required: ["service", "query"],
    additionalProperties: false,
  },
  skipPermission: true,
  handler: async ({ service, query }) => {
    console.error(`[tool] search_incident_logs service=${service} query=${JSON.stringify(query)}`);

    if (!isKnownService(service)) {
      return { error: `Unknown service: ${service}`, knownServices };
    }

    const terms = query
      .toLowerCase()
      .split(/\W+/)
      .filter((term) => term.length > 2);

    if (terms.length === 0) {
      return { error: "Provide at least one searchable keyword.", service, matches: [] };
    }

    const matches = incidentLogs[service].filter((entry) => {
      const searchableText = `${entry.level} ${entry.message}`.toLowerCase();
      return terms.some((term) => searchableText.includes(term));
    });

    return { service, query, matches };
  },
});

const getFeatureFlagStatus = defineTool<{ service: string; flag: string }>(
  "get_feature_flag_status",
  {
    description: "Get the current state and audit metadata for a service feature flag.",
    parameters: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service name, such as checkout-api." },
        flag: { type: "string", description: "Feature flag name, such as payment-provider-v2." },
      },
      required: ["service", "flag"],
      additionalProperties: false,
    },
    skipPermission: true,
    handler: async ({ service, flag }) => {
      console.error(`[tool] get_feature_flag_status service=${service} flag=${flag}`);

      if (!isKnownService(service)) {
        return { error: `Unknown service: ${service}`, knownServices };
      }

      const flags: Record<string, FeatureFlagState> = featureFlags[service];
      const state = flags[flag];

      if (!state) {
        return { error: `Unknown feature flag: ${flag}`, service, knownFlags: Object.keys(flags) };
      }

      return { service, flag, ...state };
    },
  },
);

const searchRunbooks = defineTool<{ query: string }>("search_runbooks", {
  description: "Search operational runbooks using a short incident or symptom description.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Keywords describing the incident or symptom." },
    },
    required: ["query"],
    additionalProperties: false,
  },
  skipPermission: true,
  handler: async ({ query }) => {
    console.error(`[tool] search_runbooks query=${JSON.stringify(query)}`);
    const terms = query
      .toLowerCase()
      .split(/\W+/)
      .filter((term) => term.length > 2);
    const matches = runbooks.filter((runbook) => {
      const searchableText = `${runbook.title} ${runbook.summary}`.toLowerCase();
      return terms.some((term) => searchableText.includes(term));
    });

    return { query, matches };
  },
});

type ApprovalDecision = "approved" | "declined" | "invalid" | "cancelled";

async function requestApproval(): Promise<ApprovalDecision> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return await new Promise<ApprovalDecision>((resolveDecision) => {
    let settled = false;

    const finish = (decision: ApprovalDecision) => {
      if (settled) {
        return;
      }

      settled = true;
      readline.close();
      resolveDecision(decision);
    };

    readline.once("SIGINT", () => finish("cancelled"));
    readline.once("close", () => {
      if (!settled) {
        settled = true;
        resolveDecision("cancelled");
      }
    });

    readline.question(
      "Approve disabling payment-provider-v2 for checkout-api? Type yes or no: ",
      (answer) => {
        const normalized = answer.trim().toLowerCase();

        if (normalized === "yes" || normalized === "y") {
          finish("approved");
        } else if (normalized === "no" || normalized === "n") {
          finish("declined");
        } else {
          finish("invalid");
        }
      },
    );
  });
}

type RemediationResult = {
  service: "checkout-api";
  flag: "payment-provider-v2";
  previousEnabled: boolean;
  currentEnabled: false;
  changed: boolean;
  executedAt: string;
};

function disablePaymentProviderV2(): RemediationResult {
  const flag = featureFlags["checkout-api"]["payment-provider-v2"];
  const previousEnabled = flag.enabled;
  const executedAt = new Date().toISOString();

  if (previousEnabled) {
    flag.enabled = false;
    flag.updatedAt = executedAt;
    flag.updatedBy = "incident-commander";

    serviceHealth["checkout-api"] = {
      status: "recovering",
      errorRatePercent: 1.1,
      p95LatencyMs: 420,
      incidentStartedAt: serviceHealth["checkout-api"].incidentStartedAt,
      updatedAt: executedAt,
    };
  }

  return {
    service: "checkout-api",
    flag: "payment-provider-v2",
    previousEnabled,
    currentEnabled: false,
    changed: previousEnabled,
    executedAt,
  };
}

const incident =
  process.argv.slice(2).join(" ") ||
  "Customers report checkout failures and slow responses beginning around 17:42 UTC. Triage checkout-api.";

async function main(): Promise<void> {
  const targetService = inferTargetService(incident);
  const client = new CopilotClient({
    mode: "empty",
    baseDirectory: resolve(".copilot-demo"),
  });

  try {
    const session = await client.createSession({
      model: "auto",
      streaming: true,
      tools: [
        getServiceHealth,
        getRecentDeployments,
        searchIncidentLogs,
        getFeatureFlagStatus,
        searchRunbooks,
      ],
      availableTools: ["custom:*"],
      systemMessage: {
        mode: "append",
        content:
          "You are an incident commander operating in recommendation-only mode. Investigate with the supplied read-only tools before drawing conclusions. For checkout-api, query health, recent deployments, incident logs, payment-provider-v2 flag state, and relevant runbooks. Clearly separate observed evidence from hypotheses. Return concise Markdown with severity, confidence, evidence, likely cause, proposed remediation, risks, and measurable verification criteria. The only supported remediation is disabling payment-provider-v2. Never claim an action was executed unless a later application message supplies an explicit action result.",
      },
    });

    try {
      session.on("assistant.message_delta", (event) => {
        process.stdout.write(event.data.deltaContent);
      });

      process.stdout.write("## Investigation\n\n");
      const triageResponse = await session.sendAndWait({
        prompt: `Investigate this incident and recommend, but do not execute, a remediation:\n\n${incident}`,
      });

      if (!triageResponse) {
        throw new Error("The incident-triage session completed without an assistant response.");
      }

      process.stdout.write("\n\n## Approval\n\n");

      if (targetService !== "checkout-api") {
        console.error(
          `[audit] no supported remediation target=${targetService}; the demo action applies only to checkout-api`,
        );
        process.stdout.write(
          `No executable remediation is configured for ${targetService}; investigation completed without changes.\n`,
        );
        return;
      }

      process.stdout.write(
        "Proposed fixed action: disable `payment-provider-v2` for `checkout-api`. No command from model output will be executed.\n\n",
      );

      const decision = await requestApproval();

      if (decision !== "approved") {
        console.error(`[audit] remediation_not_executed decision=${decision}`);
        process.stdout.write(
          decision === "declined"
            ? "Remediation declined. No state changed and verification was skipped.\n"
            : "Approval was not an explicit yes. No state changed and verification was skipped.\n",
        );
        return;
      }

      console.error("[audit] remediation_approved action=disable_payment_provider_v2");
      const actionResult = disablePaymentProviderV2();
      console.error(
        `[audit] remediation_completed changed=${actionResult.changed} executedAt=${actionResult.executedAt}`,
      );

      process.stdout.write("\n## Action result\n\n");
      process.stdout.write(
        actionResult.changed
          ? `Disabled \`${actionResult.flag}\` for \`${actionResult.service}\` at ${actionResult.executedAt}.\n`
          : `\`${actionResult.flag}\` was already disabled; no additional state change was required.\n`,
      );

      process.stdout.write("\n## Verification\n\n");
      const verificationResponse = await session.sendAndWait({
        prompt:
          `The application executed this fixed, operator-approved action:\n${JSON.stringify(actionResult)}\n\n` +
          "Verify recovery now. Re-query get_feature_flag_status and get_service_health for checkout-api. " +
          "Recovery requires payment-provider-v2 disabled, error rate below 2%, and p95 latency below 500 ms. " +
          "Return concise Markdown with observed post-action state, pass/fail for each criterion, overall status, and next monitoring step.",
      });

      if (!verificationResponse) {
        throw new Error("The verification session completed without an assistant response.");
      }

      process.stdout.write("\n");
    } finally {
      await session.disconnect();
    }
  } finally {
    await client.stop();
  }
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[fatal] ${message}`);
  process.exitCode = 1;
});
