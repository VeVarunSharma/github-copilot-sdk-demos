import { CopilotClient } from "@github/copilot-sdk";

const prompt = process.argv.slice(2).join(" ") || "Please tell me hello world.";
const client = new CopilotClient();

try {

  const lunaModel = "gpt-5.6-luna";

  const autoModel = "auto";
  const session = await client.createSession({
    model: autoModel,
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