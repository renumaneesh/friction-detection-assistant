export interface FrictionFlag {
  type: "cart_abandoned" | "payment_friction" | "hesitation" | "delivery_concern";
  confidence: number; // 0-1
  signal: string; // e.g. "added to cart, no purchase in 45 min"
}

export interface AtRiskSession {
  session_id: string;
  customer_id: string;
  customer_name: string; // display-only field, may not exist yet from backend —
                          // fall back to customer_id if missing
  friction_flags: FrictionFlag[]; // ARRAY — a session can have multiple flags
  product: { name: string; category: string; price: number };
  cart_value: number;
  feedback_text: string | null;
  likely_cause: string; // from Gemini, 1-2 plain-English sentences
  recommended_action: "send_reminder_email" | "offer_discount" | "route_to_agent" | "send_faq_link";
  risk_tier: "low" | "high"; // low = auto-actionable, high = needs human approval
  risk_score: number; // float, already computed server-side — do NOT recompute
  timestamp: string;
}

export interface RevenueAtRisk {
  total_revenue_at_risk: number;
  session_count: number;
  top_friction_cause: string; // one of the FrictionFlag "type" values
}
