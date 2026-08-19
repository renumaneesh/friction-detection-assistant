import type { AtRiskSession } from "./types";
import { mockSessions } from "./mockData";

// ─── Feature flag ────────────────────────────────────────────────────────────
// Set to false to fetch from the live backend instead of using mock data.
const USE_MOCK = false;
// ─────────────────────────────────────────────────────────────────────────────

// Express backend runs on port 5000 (env.js default).
// Override via NEXT_PUBLIC_API_URL in frontend/.env.local
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export async function getAtRiskSessions(): Promise<AtRiskSession[]> {
  if (USE_MOCK) {
    // Simulate a small network delay so loading states are visible in dev
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockSessions;
  }

  const res = await fetch(`${API_BASE}/sessions/at-risk`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch at-risk sessions: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<AtRiskSession[]>;
}
