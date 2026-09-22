# Architecture and data flow

## Repository progression

```mermaid
flowchart LR
    A["01 Hosted prompt"] --> B["02 Streaming events"]
    B --> C["03 Foundry BYOK"]
    C --> D["04 Incident tools + approval"]
    D --> E["05 Cost preflight + reconciliation"]
```

## Cost gateway flow

```mermaid
sequenceDiagram
    participant U as User
    participant G as Gateway CLI
    participant C as CopilotClient
    participant M as Model catalog
    participant S as Copilot session

    U->>G: Prompt + environment policy
    G->>C: start()
    G->>M: listModels()
    M-->>G: Model + billing metadata
    G->>G: Estimate tokens, AI units, USD
    G->>G: Evaluate allow / confirm / reject
    alt Approved
        G->>C: createSession(explicit model)
        G->>S: subscribe to assistant.usage
        G->>S: sendAndWait(prompt)
        S-->>G: assistant response + usage events
        G->>G: Reconcile estimate vs actual
        G-->>U: Response and usage summary
    else Rejected
        G-->>U: Decision and optimization suggestion
    end
```

## Safety boundaries

- The gateway creates a session only after approval.
- The incident demo exposes narrow custom tools and keeps mutation in application code.
- `.env` and generated Copilot state are ignored.
- Estimates are labeled as estimates; actual usage is collected from live SDK events.
- The sample USD conversion is configurable and must be replaced by an approved organizational accounting rate.
