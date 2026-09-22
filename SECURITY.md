# Security policy

## Scope

This repository contains educational examples. Do not use the simulated incident data, sample pricing, or in-memory actions as production security controls.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use the repository host's private security-reporting feature when enabled, or contact the maintainer privately through the contact listed in the repository profile.

Include a description, affected file or command, reproduction steps, impact, and a suggested mitigation when available. Do not include real credentials, customer data, or private logs.

## Safe use

- Never commit `.env`, API keys, access tokens, or copied production prompts.
- Treat model output as untrusted input.
- Keep tool permissions narrow and application-owned state changes explicit.
- The cost gateway's USD conversion is a configurable demonstration value, not a billing authority.
