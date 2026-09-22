# SDK, Copilot CLI, and Foundry comparison

| Concern | Copilot SDK | Copilot CLI | Microsoft Foundry |
|---|---|---|---|
| Primary role | Embed Copilot-style sessions in an application | Interactive developer experience in a terminal | Host and govern model deployments |
| Session lifecycle | Application-controlled client and sessions | CLI-controlled interactive sessions | Provider/deployment controlled |
| Custom tools | Define application tools and handlers | Use CLI tools and extensions according to CLI capabilities | Supply model/provider capabilities; application still owns tools |
| Approval boundary | Application can implement domain approval before a request or action | CLI asks for tool permissions and supports interactive controls | Organization/provider policies and application controls |
| Model routing | GitHub-hosted or configured provider through session settings | CLI model selection and routing | Deployment selection and endpoint configuration |
| Cost preflight in this repo | Implemented before `sendAndWait` | Not automatically intercepted by this SDK demo | Pricing and accounting are provider/organization concerns |
| Best workshop lesson | Build an application-owned agent experience | Use Copilot directly for terminal work | Bring enterprise model hosting into the session pattern |

The gateway in this repository is an SDK application, not a transparent interceptor for prompts typed into an already-running Copilot CLI session. A native CLI integration would need a separate wrapper or extension adapter.
