"use client";

import { motion } from "framer-motion";
import {
  ShoppingCart,
  CreditCard,
  Clock,
  Truck,
  TrendingUp,
  Users,
  Zap,
  Activity,
} from "lucide-react";
import type { AtRiskSession, RevenueAtRisk } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ── Friction cause icon map ─────────────────────────────────────────── */
const CAUSE_ICON: Record<string, React.ReactNode> = {
  cart_abandoned: <ShoppingCart className="h-5 w-5" />,
  payment_friction: <CreditCard className="h-5 w-5" />,
  hesitation: <Clock className="h-5 w-5" />,
  delivery_concern: <Truck className="h-5 w-5" />,
};

const CAUSE_LABEL: Record<string, string> = {
  cart_abandoned: "Cart Abandoned",
  payment_friction: "Payment Friction",
  hesitation: "Hesitation",
  delivery_concern: "Delivery Concern",
};

/* ── Card ────────────────────────────────────────────────────────────── */
function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="glass-card p-6 flex flex-col gap-4"
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border",
            accent
          )}
        >
          {icon}
        </div>
        <Activity className="h-4 w-4 text-white/20" />
      </div>

      <div>
        <p className="text-[13px] font-medium text-white/50 uppercase tracking-widest">
          {label}
        </p>
        <p className="mt-1 font-serif text-4xl font-normal text-white leading-none">
          {value}
        </p>
        {sub && (
          <p className="mt-1.5 text-[12px] text-white/40">{sub}</p>
        )}
      </div>
    </motion.div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────── */
interface SummaryCardsProps {
  summary: RevenueAtRisk;
  sessions: AtRiskSession[];
}

export function SummaryCards({ summary, sessions }: SummaryCardsProps) {
  // Average confidence across ALL friction flags across all sessions
  const allFlags = sessions.flatMap((s) => s.friction_flags);
  const avgConfidence =
    allFlags.length > 0
      ? allFlags.reduce((acc, f) => acc + f.confidence, 0) / allFlags.length
      : 0;

  const highRiskCount = sessions.filter((s) => s.risk_tier === "high").length;

  const cards = [
    {
      icon: <TrendingUp className="h-5 w-5 text-rose-400" />,
      label: "Revenue at Risk",
      value: `${summary.total_revenue_at_risk.toFixed(2)}`,
      sub: `Cumulative risk score across ${summary.session_count} sessions`,
      accent: "bg-rose-500/10 border-rose-500/20 text-rose-400",
      delay: 0,
    },
    {
      icon: <Users className="h-5 w-5 text-violet-400" />,
      label: "At-Risk Sessions",
      value: String(summary.session_count),
      sub: `${highRiskCount} need human approval`,
      accent: "bg-violet-500/10 border-violet-500/20 text-violet-400",
      delay: 0.08,
    },
    {
      icon: CAUSE_ICON[summary.top_friction_cause] ?? <Zap className="h-5 w-5 text-amber-400" />,
      label: "Top Friction Cause",
      value: CAUSE_LABEL[summary.top_friction_cause] ?? summary.top_friction_cause,
      sub: "Most frequent signal in current window",
      accent: "bg-amber-500/10 border-amber-500/20 text-amber-400",
      delay: 0.16,
    },
    {
      icon: <Zap className="h-5 w-5 text-teal-400" />,
      label: "Avg. Confidence",
      value: `${(avgConfidence * 100).toFixed(1)}%`,
      sub: `Across ${allFlags.length} friction signals`,
      accent: "bg-teal-500/10 border-teal-500/20 text-teal-400",
      delay: 0.24,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
