# Troubleshooting and FAQ

## Node version errors

Use Node.js `^20.19.0` or `>=22.12.0`. Check with:

```powershell
node --version
npm --version
```

## Authentication failures

The GitHub-hosted demos require a supported local GitHub Copilot authentication flow. Log in with the Copilot CLI if needed, then retry the demo. Authentication is not needed for the pure unit tests.

## Model unavailable

The cost gateway requires an explicit model ID. `auto` is intentionally rejected because it cannot be priced deterministically before routing. Use a model available to the authenticated account and keep `GATEWAY_MODEL` aligned with it.

## Foundry configuration

Check `FOUNDRY_MODEL`, `FOUNDRY_BASE_URL`, `FOUNDRY_API_KEY`, and `FOUNDRY_WIRE_API`. For the Azure example, use only the resource host in `FOUNDRY_BASE_URL`—do not append `/openai/v1/`. Set the optional `FOUNDRY_API_VERSION` only when the deployment requires a specific API version.

## Interactive approval does not work

Medium- and high-cost requests require an interactive terminal. In CI or redirected output, use a low-cost auto-approved request or set a hard budget to demonstrate fail-closed rejection.

## Why did actual cost differ from the estimate?

The estimator includes conservative overhead but cannot know the final hidden context, cache behavior, reasoning, retries, tool calls, or generated length. The SDK's live `assistant.usage` events are the authoritative demo-time accounting signal when available.

## Is the USD amount a bill?

No. `GATEWAY_USD_PER_AI_UNIT` is an explicit conversion setting for the demonstration. Replace it with an approved organizational accounting rate and treat provider billing records as authoritative.

## Where is runtime state?

The SDK may create `.copilot-demo` state. It is ignored by Git and should not be committed or shared.

## Which checks should a contributor run?

```powershell
npm test
npm run typecheck
```
