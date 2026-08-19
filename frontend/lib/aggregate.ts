import type { AtRiskSession, RevenueAtRisk } from "./types";

/**
 * Derives RevenueAtRisk from the full session list.
 * Pure function — swap to a real endpoint call without changing any component.
 */
export function aggregateRevenueAtRisk(sessions: AtRiskSession[]): RevenueAtRisk {
  if (sessions.length === 0) {
    return { total_revenue_at_risk: 0, session_count: 0, top_friction_cause: "cart_abandoned" };
  }

  // Sum risk_score as a proxy for revenue at risk (server already computed it)
  const total_revenue_at_risk = sessions.reduce((sum, s) => sum + s.risk_score, 0);

  // Find the most frequent friction flag type across all sessions
  const counts: Record<string, number> = {};
  for (const session of sessions) {
    for (const flag of session.friction_flags) {
      counts[flag.type] = (counts[flag.type] ?? 0) + 1;
    }
  }
  const top_friction_cause = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  return {
    total_revenue_at_risk,
    session_count: sessions.length,
    top_friction_cause,
  };
}
