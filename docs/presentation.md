# Presentation narrative

This talk track is designed for a short presentation followed by the hands-on lab in [`workshop.md`](workshop.md).

## Story

The GitHub Copilot SDK lets an application host Copilot-style sessions while owning the surrounding product experience: prompts, tools, permissions, provider configuration, events, and lifecycle. The repository moves from the smallest possible call to governance patterns that matter in real systems.

## Suggested flow

### 1. Start with the smallest session

Open `src/01-github-hosted.ts`. Highlight:

- `CopilotClient` is the application boundary;
- `createSession` establishes the conversation;
- `sendAndWait` is the simplest request/response path;
- `disconnect` and `stop` are explicit cleanup.

Run:

```powershell
npm run demo:github -- "Explain tool calling in one paragraph."
```

### 2. Add streaming

Open `src/02-github-streaming.ts`. Explain that the same session model can expose incremental events without changing the provider abstraction.

Run:

```powershell
npm run demo:stream -- "Write a four-line poem about TypeScript."
```

### 3. Separate orchestration from inference

Open `src/03-foundry-byok.ts`. The SDK still owns sessions and orchestration, while the configured provider owns inference. This is the point to discuss enterprise-hosted models, endpoint configuration, and secrets.

### 4. Make tools narrow and actions explicit

Open `src/04-incident-triage.ts`. The model can investigate with read-only tools, but application code owns the state-changing feature-flag action and verification. Emphasize that model text is not an executable command.

### 5. Add cost governance

Open `src/05-cost-gateway.ts` and `src/cost-gateway.ts`. The preflight runs before `sendAndWait`, uses model billing metadata, applies policy, and reconciles live `assistant.usage` data afterward. This is application-level gating; it is not a documented native prompt prehook for the interactive Copilot CLI.

Run:

```powershell
Copy-Item .env.example .env
$env:GATEWAY_MODEL = "gpt-5.6-luna"
$env:GATEWAY_USD_PER_AI_UNIT = "0.01"
$env:GATEWAY_EXPECTED_OUTPUT_TOKENS = "300"
npm run demo:gateway -- "Explain the value of a cost-aware AI gateway in three bullets."
```

## Closing message

The SDK is most valuable when the application needs Copilot capabilities but must retain ownership of product behavior, tool boundaries, provider selection, approval, telemetry, and governance.
