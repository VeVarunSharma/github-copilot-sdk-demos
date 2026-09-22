# Contributing

Thank you for helping improve this GitHub Copilot SDK workshop. Contributions should make the examples easier to understand, safer to run, or more useful for a live hands-on session.

## Development setup

```powershell
git clone <your-fork-url>
Set-Location ghcp-sdk-demo
npm install
npm test
npm run typecheck
```

Use Node.js `^20.19.0` or `>=22.12.0`. Copy `.env.example` to `.env` only when a demo needs configuration. Keep secrets and generated `.copilot-demo` state local.

## Making a change

1. Create a focused branch from the default branch.
2. Keep examples small and explain SDK-specific behavior in nearby documentation.
3. Prefer existing SDK patterns and preserve nested cleanup for clients and sessions.
4. Add or update tests for reusable logic.
5. Update the README or workshop docs when commands, prerequisites, or expected behavior change.
6. Run `npm test` and `npm run typecheck`.

## Pull requests

Pull requests should describe:

- what changed and why;
- which demo or documentation path is affected;
- how the change was validated;
- any live credentials, model availability, or terminal-interaction requirements.

Do not include `.env`, API keys, Copilot session state, generated output logs, or customer data.

## Workshop-friendly changes

Prefer changes that can be explained in a short presentation segment or lab checkpoint. If a change adds provider-specific behavior, label it clearly and preserve a path that works with the GitHub-hosted demos.
