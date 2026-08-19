"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Filter,
  ArrowUpDown,
  Mail,
  Tag,
  Headphones,
  HelpCircle,
} from "lucide-react";
import type { AtRiskSession } from "@/lib/types";
import { FrictionBadge } from "./FrictionBadge";
import { RiskTierBadge } from "./RiskTierBadge";
import { RecoveryPanelStub } from "./RecoveryPanelStub";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────────────────────────────── */
type SortKey = "risk_score" | "cart_value" | "customer_name";
type SortDir = "asc" | "desc";
type FrictionFilter =
  | "all"
  | "cart_abandoned"
  | "payment_friction"
  | "hesitation"
  | "delivery_concern";
type TierFilter = "all" | "low" | "high";

/* ── Action labels ──────────────────────────────────────────────────── */
const ACTION_CONFIG: Record<
  AtRiskSession["recommended_action"],
  { label: string; icon: React.ReactNode; color: string }
> = {
  send_reminder_email: {
    label: "Reminder Email",
    icon: <Mail className="h-3.5 w-3.5" />,
    color: "text-sky-300 bg-sky-500/10 border-sky-500/20",
  },
  offer_discount: {
    label: "Offer Discount",
    icon: <Tag className="h-3.5 w-3.5" />,
    color: "text-teal-300 bg-teal-500/10 border-teal-500/20",
  },
  route_to_agent: {
    label: "Route to Agent",
    icon: <Headphones className="h-3.5 w-3.5" />,
    color: "text-rose-300 bg-rose-500/10 border-rose-500/20",
  },
  send_faq_link: {
    label: "Send FAQ Link",
    icon: <HelpCircle className="h-3.5 w-3.5" />,
    color: "text-violet-300 bg-violet-500/10 border-violet-500/20",
  },
};

/* ── Sort icon ──────────────────────────────────────────────────────── */
function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3.5 w-3.5 text-white/25" />;
  return sortDir === "desc"
    ? <ChevronDown className="h-3.5 w-3.5 text-white/70" />
    : <ChevronUp className="h-3.5 w-3.5 text-white/70" />;
}

/* ── Risk score bar ─────────────────────────────────────────────────── */
function RiskBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "bg-rose-500" : pct >= 60 ? "bg-amber-500" : "bg-teal-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[13px] font-mono text-white/80 tabular-nums w-8">
        {pct}%
      </span>
    </div>
  );
}

/* ── Filter pill ────────────────────────────────────────────────────── */
function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all duration-200",
        active
          ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
          : "bg-white/05 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20"
      )}
    >
      {children}
    </button>
  );
}

/* ── Main ────────────────────────────────────────────────────────────── */
interface SessionsTableProps {
  sessions: AtRiskSession[];
}

export function SessionsTable({ sessions }: SessionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [frictionFilter, setFrictionFilter] = useState<FrictionFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [selectedSession, setSelectedSession] = useState<AtRiskSession | null>(null);
  const [expandedCause, setExpandedCause] = useState<string | null>(null);

  /* ── Sort ───────────────────────────────────────────────────────── */
  function handleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(col);
      setSortDir("desc");
    }
  }

  /* ── Filtered + sorted data ─────────────────────────────────────── */
  const filtered = useMemo(() => {
    let result = [...sessions];

    if (frictionFilter !== "all") {
      result = result.filter((s) =>
        s.friction_flags.some((f) => f.type === frictionFilter)
      );
    }

    if (tierFilter !== "all") {
      result = result.filter((s) => s.risk_tier === tierFilter);
    }

    result.sort((a, b) => {
      let av: string | number =
        sortKey === "customer_name"
          ? (a.customer_name || a.customer_id).toLowerCase()
          : a[sortKey];
      let bv: string | number =
        sortKey === "customer_name"
          ? (b.customer_name || b.customer_id).toLowerCase()
          : b[sortKey];

      if (typeof av === "string" && typeof bv === "string")
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });

    return result;
  }, [sessions, frictionFilter, tierFilter, sortKey, sortDir]);

  /* ── Column header helper ───────────────────────────────────────── */
  function Th({
    col,
    children,
  }: {
    col?: SortKey;
    children: React.ReactNode;
  }) {
    return (
      <th
        className={cn(
          "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/40",
          col && "cursor-pointer select-none hover:text-white/70 transition-colors"
        )}
        onClick={() => col && handleSort(col)}
      >
        <div className="flex items-center gap-1.5">
          {children}
          {col && <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />}
        </div>
      </th>
    );
  }

  return (
    <>
      {/* ── Filters ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="glass-card p-4 flex flex-wrap items-center gap-3"
      >
        <div className="flex items-center gap-2 text-white/50 mr-2">
          <Filter className="h-4 w-4" />
          <span className="text-[12px] uppercase tracking-widest font-medium">Filter</span>
        </div>

        {/* Friction type filter */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All Types"],
              ["cart_abandoned", "🛒 Cart Abandoned"],
              ["payment_friction", "💳 Payment Friction"],
              ["hesitation", "⏱ Hesitation"],
              ["delivery_concern", "📦 Delivery Concern"],
            ] as [FrictionFilter, string][]
          ).map(([val, label]) => (
            <FilterPill
              key={val}
              active={frictionFilter === val}
              onClick={() => setFrictionFilter(val)}
            >
              {label}
            </FilterPill>
          ))}
        </div>

        <div className="h-5 w-px bg-white/10 mx-1 hidden sm:block" />

        {/* Tier filter */}
        <div className="flex gap-2">
          {(["all", "low", "high"] as TierFilter[]).map((t) => (
            <FilterPill
              key={t}
              active={tierFilter === t}
              onClick={() => setTierFilter(t)}
            >
              {t === "all" ? "All Tiers" : t === "low" ? "🟢 Auto" : "🟡 Needs Approval"}
            </FilterPill>
          ))}
        </div>

        <div className="ml-auto text-[12px] text-white/30">
          {filtered.length} / {sessions.length} sessions
        </div>
      </motion.div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.07)]">
                <Th col="customer_name">Customer</Th>
                <Th>Friction Signals</Th>
                <Th col="risk_score">
                  <div className="flex items-center gap-1">
                    Risk Score <ArrowUpDown className="h-3 w-3" />
                  </div>
                </Th>
                <Th col="cart_value">Cart Value</Th>
                <Th>Likely Cause</Th>
                <Th>Action</Th>
                <Th>Tier</Th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filtered.map((session, idx) => {
                  const displayName = session.customer_name || session.customer_id;
                  const action = ACTION_CONFIG[session.recommended_action];
                  const isExpanded = expandedCause === session.session_id;

                  return (
                    <motion.tr
                      key={session.session_id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{
                        duration: 0.35,
                        delay: idx * 0.04,
                        ease: [0.25, 0.46, 0.45, 0.94],
                      }}
                      className="glass-row"
                      onClick={() => setSelectedSession(session)}
                    >
                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-[14px] font-medium text-white">{displayName}</p>
                          <p className="text-[11px] text-white/35 font-mono mt-0.5">
                            {session.customer_id}
                          </p>
                        </div>
                      </td>

                      {/* Friction badges */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {session.friction_flags.map((flag) => (
                            <FrictionBadge key={flag.type} type={flag.type} />
                          ))}
                        </div>
                      </td>

                      {/* Risk score */}
                      <td className="px-4 py-3.5">
                        <RiskBar score={session.risk_score} />
                      </td>

                      {/* Cart value */}
                      <td className="px-4 py-3.5">
                        <span className="text-[14px] font-medium text-white/80 tabular-nums">
                          ${session.cart_value.toFixed(2)}
                        </span>
                      </td>

                      {/* Likely cause — truncate, expand on hover */}
                      <td className="px-4 py-3.5 max-w-[220px]">
                        <div
                          className="relative group"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedCause(
                              isExpanded ? null : session.session_id
                            );
                          }}
                        >
                          <p
                            className={cn(
                              "text-[13px] text-white/55 leading-relaxed transition-all cursor-pointer",
                              isExpanded ? "" : "line-clamp-2"
                            )}
                          >
                            {session.likely_cause}
                          </p>
                          {!isExpanded && (
                            <span className="text-[11px] text-indigo-400/70 mt-0.5 block">
                              Click to expand
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Recommended action */}
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                            action.color
                          )}
                        >
                          {action.icon}
                          {action.label}
                        </span>
                      </td>

                      {/* Risk tier */}
                      <td className="px-4 py-3.5">
                        <RiskTierBadge tier={session.risk_tier} />
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-white/30 text-sm">
                    No sessions match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── Recovery panel slide-over ────────────────────────────────── */}
      <RecoveryPanelStub
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </>
  );
}
