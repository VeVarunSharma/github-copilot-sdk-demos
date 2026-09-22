import { CopilotClient } from "@github/copilot-sdk";

const prompt = process.argv.slice(2).join(" ") || "Give me three practical uses for an agent SDK.";
const client = new CopilotClient();

try {
  const session = await client.createSession({
    model: "auto",
    streaming: true,
  });

  try {
    session.on("assistant.message_delta", (event) => {
      process.stdout.write(event.data.deltaContent);
    });

    const response = await session.sendAndWait({ prompt });

    if (!response) {
      throw new Error("The session completed without an assistant response.");
    }

    process.stdout.write("\n");
  } finally {
    await session.disconnect();
  }
} finally {
  await client.stop();
}
