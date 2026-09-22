# GitHub Copilot SDK workshop

A presentation and hands-on workshop repository for building agents with the GitHub Copilot SDK. The examples progress from a one-shot prompt to streaming, Microsoft Foundry BYOK, controlled incident triage, and a cost-aware AI gateway.

## Quick start

### Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- GitHub Copilot authentication for the GitHub-hosted demos
- Optional: a Microsoft Foundry deployment and API key for demo 03

The SDK package includes the compatible Copilot runtime. Existing Copilot CLI authentication can be reused by the SDK.

### Install and validate

```powershell
git clone https://github.com/VeVarunSharma/github-copilot-sdk-demos.git
cd github-copilot-sdk-demos
npm install
npm test
npm run typecheck
```

### Run the demos

| Demo | Command | Focus |
|---|---|---|
| 01 | `npm run demo:github` | Create a session and send a prompt |
| 02 | `npm run demo:stream -- "Write a four-line poem."` | Stream `assistant.message_delta` events |
| 03 | `npm run demo:foundry -- "Explain private model hosting."` | Route a session to Microsoft Foundry |
| 04 | `npm run demo:incident` | Use custom tools and application-owned approval |
| 05 | `npm run demo:gateway -- "Explain this repository."` | Estimate cost, approve, execute, and reconcile usage |

Copy `.env.example` to `.env` before using the Foundry or cost gateway demos:

```powershell
Copy-Item .env.example .env
```

Never commit `.env`, API keys, tokens, or generated `.copilot-demo` state.

## Choose your path

- **Presenting the SDK:** start with [`docs/presentation.md`](docs/presentation.md), then use [`docs/demo-script.md`](docs/demo-script.md).
- **Running the workshop:** follow [`docs/workshop.md`](docs/workshop.md).
- **Understanding the design:** read [`docs/architecture.md`](docs/architecture.md) and [`docs/sdk-cli-foundry-comparison.md`](docs/sdk-cli-foundry-comparison.md).
- **Contributing or forking:** read [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Troubleshooting:** see [`docs/troubleshooting.md`](docs/troubleshooting.md).

## What the examples demonstrate

### GitHub-hosted sessions

`01-github-hosted.ts` is the smallest useful example: create a `CopilotClient`, create a session, call `sendAndWait`, print the response, and clean up.

`02-github-streaming.ts` adds event subscription and writes incremental assistant deltas as they arrive.

### Microsoft Foundry BYOK

`03-foundry-byok.ts` keeps the Copilot SDK session and orchestration model while routing inference through an Azure Foundry endpoint. Set `FOUNDRY_BASE_URL` to the resource host without `/openai/v1/`; the SDK uses the Azure provider shape and constructs the route. See the `.env.example` comments and the official [BYOK documentation](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/byok).

### Controlled incident triage

`04-incident-triage.ts` exposes read-only custom tools and keeps the only state-changing action in application code. The model cannot execute arbitrary shell commands or turn its own text into an action.

### Cost-aware AI gateway

`05-cost-gateway.ts` performs application-level preflight before `session.sendAndWait()`. It uses SDK model billing metadata to estimate AI units and configurable USD, applies approval thresholds, suggests a cheaper model, and aggregates live `assistant.usage` events afterward. Estimates are not invoices, and the sample USD rate is illustrative.

## Repository status and scope

This is an educational demo, not a production gateway or incident-management system. It intentionally uses in-memory data, local configuration, and small focused examples. Production systems should add durable audit records, authorization, redaction, idempotency, provider-specific pricing governance, and infrastructure-system verification.

## Contributing

Bug reports, workshop improvements, and small focused pull requests are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md), run the local validation commands, and do not include secrets or generated runtime state.

## Official references

- [GitHub Copilot SDK](https://github.com/github/copilot-sdk)
- [SDK getting started](https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md)
- [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli)
- [Microsoft Foundry BYOK](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/byok)
