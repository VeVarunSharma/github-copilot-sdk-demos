# Hands-on workshop

## Learning objectives

By the end of the lab, participants will be able to:

- create and clean up a Copilot SDK client and session;
- subscribe to streaming session events;
- route a session to a Foundry deployment;
- expose narrow custom tools and keep actions in application code;
- estimate and govern model cost before execution;
- compare estimated and actual SDK usage.

## Lab 0: Prepare the repository

```powershell
npm install
npm test
npm run typecheck
```

If authentication is available, run:

```powershell
npm run demo:github -- "Explain the GitHub Copilot SDK in one sentence."
```

Checkpoint: identify where the client is created, where the session is created, and where cleanup happens.

## Lab 1: Streaming

```powershell
npm run demo:stream -- "Write a four-line poem about TypeScript."
```

Exercise: locate `assistant.message_delta` and explain why the final response still comes from `sendAndWait`.

## Lab 2: Provider configuration

Copy `.env.example` to `.env` and configure the Foundry values if available:

```powershell
npm run demo:foundry -- "Summarize the benefits of private model hosting."
```

Checkpoint: identify which parts remain Copilot SDK orchestration and which values configure the inference provider.

## Lab 3: Tools and approvals

```powershell
npm run demo:incident
```

Exercise: trace the read-only tools, the approval prompt, the application-owned feature-flag mutation, and the verification pass.

## Lab 4: Cost gateway

```powershell
$env:GATEWAY_MODEL = "gpt-5.6-luna"
$env:GATEWAY_USD_PER_AI_UNIT = "0.01"
$env:GATEWAY_EXPECTED_OUTPUT_TOKENS = "300"
npm run demo:gateway -- "Explain a cost-aware AI gateway in three bullets."
```

Observe the preflight estimate, policy decision, assistant response, and usage reconciliation.

## Lab 5: Diff the cost

Use a larger output budget and a hard zero budget to demonstrate blocking without inference:

```powershell
$env:GATEWAY_EXPECTED_OUTPUT_TOKENS = "12000"
$env:GATEWAY_MAX_REQUEST_AIU = "0"
npm run demo:gateway -- "Produce a comprehensive enterprise migration plan."
Remove-Item Env:GATEWAY_MAX_REQUEST_AIU
```

Exercise: explain why output budget and model choice change the estimate, and why the estimate is not an invoice.

## Extension ideas

- Add a persistent usage ledger.
- Add an HTTP adapter around the estimator and policy core.
- Add team or project budgets.
- Add provider-specific pricing sources.
- Add a review mode that compares quality and cost across models.
