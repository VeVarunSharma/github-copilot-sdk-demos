# Timed demo script

Use this script for a presentation. The commands assume Windows PowerShell and a completed `npm install`.

## Before the session

```powershell
npm install
npm test
npm run typecheck
Copy-Item .env.example .env
```

Authenticate with the GitHub Copilot CLI or another supported local flow before running GitHub-hosted demos.

## Demo sequence

| Segment | Command | Point to make |
|---|---|---|
| 1. Hello session | `npm run demo:github -- "Explain the Copilot SDK in one sentence."` | Client, session, prompt, cleanup |
| 2. Streaming | `npm run demo:stream -- "Write a four-line poem."` | Event-driven output |
| 3. BYOK | `npm run demo:foundry -- "Summarize private model hosting."` | Session harness versus inference provider |
| 4. Incident triage | `npm run demo:incident` | Read-only tools, explicit approval, verification |
| 5. Cost governance | `npm run demo:gateway -- "Explain a cost-aware gateway."` | Preflight, policy, actual usage |

## Cost gateway setup

Set a model available to the account and an illustrative conversion rate:

```powershell
$env:GATEWAY_MODEL = "gpt-5.6-luna"
$env:GATEWAY_USD_PER_AI_UNIT = "0.01"
$env:GATEWAY_EXPECTED_OUTPUT_TOKENS = "300"
```

For a no-spend preflight demonstration, set a hard budget of zero:

```powershell
$env:GATEWAY_MAX_REQUEST_AIU = "0"
npm run demo:gateway -- "Produce a comprehensive migration plan."
Remove-Item Env:GATEWAY_MAX_REQUEST_AIU
```

For a live approved run, remove the hard budget and use a small output budget:

```powershell
npm run demo:gateway -- "Explain the value of a cost-aware gateway in three bullets."
```

## Fallbacks

- If authentication is unavailable, run `npm test`, `npm run typecheck`, and the zero-budget gateway preflight.
- If the selected model is unavailable, set `GATEWAY_MODEL` to an ID returned by the account's available model list.
- If Foundry credentials are unavailable, skip demo 03 and explain the provider configuration from the source.
- If the terminal is non-interactive, use an auto-approved low-cost request or a hard-budget rejection; confirmation and override prompts require a TTY.
