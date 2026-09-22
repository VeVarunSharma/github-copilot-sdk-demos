import { CopilotClient } from "@github/copilot-sdk";

const prompt = process.argv.slice(2).join(" ") || "Explain the GitHub Copilot SDK in one sentence.";
const client = new CopilotClient();

try {
  const session = await client.createSession({ model: "auto" });

  try {
    const response = await session.sendAndWait({ prompt });

    if (!response) {
      throw new Error("The session completed without an assistant response.");
    }

    
    console.log(response.data.content);
  } finally {
    await session.disconnect();
  }
} finally {
  await client.stop();
}
