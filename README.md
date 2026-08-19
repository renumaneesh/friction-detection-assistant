# Friction Detection Assistant

An intelligent assistant designed to detect real-time user friction, analyze behavioral bottlenecks with AI reasoning, and execute automated recovery interventions.

## Project Structure

```
friction-detection-assistant/
├── backend/
│   ├── data_generation/       # synthetic data scripts
│   ├── rule_engine/           # Tier 1 detection logic
│   ├── ai_reasoning/          # Gemini integration (Tier 3)
│   ├── api/                   # FastAPI routes
│   ├── db/                    # schema, migrations
│   └── requirements.txt
├── frontend/
│   ├── app/                   # Next.js pages
│   ├── components/            # dashboard, recovery UI
│   └── package.json
├── docs/
│   ├── pitch/
│   └── architecture.md
├── .env.example
└── README.md
```

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```
