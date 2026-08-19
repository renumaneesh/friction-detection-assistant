# Architecture Overview

## System Architecture

```mermaid
graph TD
    Client[User Client / E-Commerce Store] -->|Clickstream & Events| IngestAPI[FastAPI Ingestion]
    IngestAPI --> DB[(Database / SQLite)]
    IngestAPI --> RuleEngine[Tier 1: Rule Engine Heuristics]
    RuleEngine -->|Friction Alerts| AIReasoning[Tier 3: AI Reasoning / Gemini]
    AIReasoning -->|Root Cause & Action Plan| Recovery[Recovery Engine]
    Recovery -->|Interventions / Playbooks| Client
    Dashboard[Next.js Dashboard] -->|Telemetry & Metrics| IngestAPI
```

## Layers

1. **Backend**
   - `data_generation/`: Synthetic clickstream and scenario simulation scripts.
   - `rule_engine/`: Deterministic heuristic detection logic (Rage clicks, validation deadlock, hesitation, gateway failures).
   - `ai_reasoning/`: Multimodal / LLM reasoning with Gemini for deep diagnosis, churn estimation, and automated playbook generation.
   - `api/`: REST & WebSocket endpoints via FastAPI.
   - `db/`: Database schemas, ORM models, and persistence.

2. **Frontend**
   - `app/`: Next.js pages and layouts.
   - `components/`: Real-time dashboard, session playback stream, and recovery action interfaces.

3. **Docs**
   - `pitch/`: Presentation resources and concept deck.
   - `architecture.md`: System layout and workflow specifications.
