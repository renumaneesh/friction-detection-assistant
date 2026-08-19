# Architecture Overview

> **Note:** Architecture reflects the actual integrated MVP stack. Python reference modules
> (`backend/ai_reasoning/`, `backend/rule_engine/`, `backend/api/`) are retained as
> documentation of the original design intent — they are not part of the running system.

## Actual Stack

| Layer | Technology |
|---|---|
| **Backend API** | Node.js / Express 4 (`backend/src/server.js`) |
| **Rule Engine (Tier 1)** | Pure JS heuristics — `backend/src/services/tier1Detection.js` |
| **AI Reasoning (Tier 3)** | Gemini via `@google/genai` — `backend/src/services/geminiClient.js` |
| **Data Source** | JSON in-memory (`backend/data_generation/output/synthetic_data.json`, 300 sessions) |
| **Persistence** | MongoDB/Mongoose (optional — graceful in-memory fallback if unavailable) |
| **Frontend** | Next.js 14 App Router + Tailwind CSS |
| **AI Model** | `gemini-3.6-flash` (structured JSON output via `responseMimeType + responseSchema`) |

---

## System Flow

```mermaid
graph TD
    JSON["synthetic_data.json\n(300 sessions, 180 customers, 40 products)"]
    DataLoader["DataLoader\n(in-memory bootstrap on startup)"]
    API["Express API\nlocalhost:5000"]
    T1["Tier 1: Rule Engine\ntier1Detection.js\n(payment failure, cart abandonment,\nhesitation, rage clicks...)"]
    GATE{"friction_flags\n> 0 ?"}
    GEMINI["Tier 3: geminiClient.js\ngemini-3.6-flash\nReturns: likely_cause,\nrecommended_action,\nrisk_tier"]
    RISK["revenueRisk.js\ncartValue × dropOffFreq × (1 - recoveryRate)"]
    RESULT["AtRiskSession response\n(sorted by risk_score desc)"]
    FRONTEND["Next.js Dashboard\nlocalhost:3000"]
    RECOVERY["RecoveryPanel\nrisk_tier drives auto/approve split"]

    JSON --> DataLoader --> API
    API --> T1 --> GATE
    GATE -- "No flags" --> |"NO Gemini call\n(cost efficiency)"| RESULT
    GATE -- "1+ flags" --> GEMINI --> RISK --> RESULT
    RESULT --> FRONTEND --> RECOVERY
```

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service liveness check |
| `GET` | `/sessions/at-risk` | All flagged sessions (Tier1 + Gemini pipeline) |
| `GET` | `/sessions/:id/friction` | Single session friction analysis |
| `GET` | `/dashboard/summary` | Aggregated stats — `{total_revenue_at_risk, session_count, top_friction_cause}` |
| `POST` | `/api/events` | Live event ingestion (real-time cascade) |
| `GET` | `/api/friction/events` | Friction event list |
| `GET` | `/api/insights/systemic` | Cross-session insight breakdown |
| `GET` | `/api/insights/revenue-at-risk` | Revenue at risk aggregate |
| `GET` | `/api/automation/human-queue` | Pending human escalations |
| `PATCH` | `/api/automation/:id/resolve` | Approve / reject escalation |

---

## Revenue Risk Formula (JS — authoritative)

```
revenueAtRisk = cartValue × dropOffFrequency × (1 − historicalRecoveryRate)
```

Type weights:
| Friction Type | dropOffFreq | recoveryRate |
|---|---|---|
| `payment_failure` | 0.85 | 0.20 |
| `cart_abandonment` | 0.70 | 0.15 |
| `step_dropoff` | 0.60 | 0.25 |
| `time_on_page_exceeded` | 0.45 | 0.20 |
| `rage_clicks` | 0.50 | 0.10 |

`risk_score` (0–1) = `revenueAtRisk / cartValue`

---

## Recovery Automation Logic

`risk_tier` from Gemini drives the UX split in the RecoveryPanel:
- `"low"` → auto-actionable (send_reminder_email, send_faq_link) — auto-sent badge
- `"high"` → requires human approval (offer_discount, route_to_agent) — approve/edit buttons

---

## Python Reference Modules (not in execution path)

These files document the original multi-person branch design:
- `backend/ai_reasoning/gemini_client.py` — original system prompt source (ported to `geminiClient.js`)
- `backend/ai_reasoning/revenue_score.py` — alternative scoring formula (not used)
- `backend/rule_engine/` — placeholder (rule logic lives in `tier1Detection.js`)
- `backend/api/` — placeholder (API lives in `backend/src/routes/`)
- `backend/db/models.py` — SQLAlchemy schema reference
