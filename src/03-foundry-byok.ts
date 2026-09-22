import "dotenv/config";
import { CopilotClient } from "@github/copilot-sdk";

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and set the Foundry connection value.`);
  }

  return value;
}

const wireApiValue = process.env.FOUNDRY_WIRE_API?.trim() || "responses";

if (wireApiValue !== "responses" && wireApiValue !== "completions") {
  throw new Error('FOUNDRY_WIRE_API must be either "responses" or "completions".');
}

const model = requireEnvironmentVariable("FOUNDRY_MODEL");
const baseUrl = requireEnvironmentVariable("FOUNDRY_BASE_URL");
const apiKey = requireEnvironmentVariable("FOUNDRY_API_KEY");
const apiVersion = process.env.FOUNDRY_API_VERSION?.trim();
const prompt =
  process.argv.slice(2).join(" ") ||
  "Explain why an SDK harness around an enterprise-hosted model is useful in two bullets.";

const client = new CopilotClient();

try {
  const session = await client.createSession({
    model,
    provider: {
      type: "azure",
      baseUrl,
      apiKey,
      wireApi: wireApiValue,
      ...(apiVersion ? { azure: { apiVersion } } : {}),
    },
  });

  try {
    const response = await session.sendAndWait({ prompt });

    if (!response) {
      throw new Error("The Foundry-backed session completed without an assistant response.");
    }

    console.log(response.data.content);
  } finally {
    await session.disconnect();
  }
} finally {
  await client.stop();
}
