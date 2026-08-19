"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Bot, Zap, Clock, ShoppingBag } from "lucide-react";
import type { AtRiskSession } from "@/lib/types";
import { FrictionBadge } from "./FrictionBadge";
import { RiskTierBadge } from "./RiskTierBadge";

interface RecoveryPanelStubProps {
  session: AtRiskSession | null;
  onClose: () => void;
}

/**
 * Slide-over shell — Person 5 fills in the recovery/approval logic.
 * Accepts `session: AtRiskSession` and renders a structured placeholder.
 */
export function RecoveryPanelStub({ session, onClose }: RecoveryPanelStubProps) {
  return (
    <AnimatePresence>
      {session && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto
                       bg-[#0D1020] border-l border-[rgba(255,255,255,0.08)]
                       shadow-[−24px_0_80px_rgba(0,0,0,0.6)]"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-[rgba(255,255,255,0.08)]">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-widest text-white/40">
                  Recovery Panel
                </p>
                <h2 className="font-serif text-2xl text-white mt-1">
                  {session.customer_name || session.customer_id}
                </h2>
                <p className="text-[13px] text-white/40 mt-0.5">{session.session_id}</p>
              </div>
              <button
                onClick={onClose}
                className="mt-1 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/08
                           transition-colors"
                aria-label="Close panel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Session snapshot */}
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                <RiskTierBadge tier={session.risk_tier} />
                {session.friction_flags.map((flag) => (
                  <FrictionBadge key={flag.type} type={flag.type} />
                ))}
              </div>

              <div className="glass-card p-4 space-y-3">
                <div className="flex items-center gap-2 text-[12px] text-white/40 uppercase tracking-widest">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Session snapshot
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-white/40 text-[11px]">Product</p>
                    <p className="text-white font-medium mt-0.5 truncate">{session.product.name}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[11px]">Cart Value</p>
                    <p className="text-white font-medium mt-0.5">${session.cart_value.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[11px]">Risk Score</p>
                    <p className="text-white font-medium mt-0.5">{(session.risk_score * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-white/40 text-[11px]">Category</p>
                    <p className="text-white font-medium mt-0.5">{session.product.category}</p>
                  </div>
                </div>
              </div>

              <div className="glass-card p-4">
                <div className="flex items-center gap-2 text-[12px] text-white/40 uppercase tracking-widest mb-3">
                  <Bot className="h-3.5 w-3.5" />
                  Gemini analysis
                </div>
                <p className="text-[14px] text-white/70 leading-relaxed">{session.likely_cause}</p>
              </div>

              {session.feedback_text && (
                <div className="glass-card p-4">
                  <p className="text-[12px] text-white/40 uppercase tracking-widest mb-2">
                    Customer Feedback
                  </p>
                  <p className="text-[14px] text-white/60 italic">
                    &ldquo;{session.feedback_text}&rdquo;
                  </p>
                </div>
              )}

              {/* ── Placeholder for Person 5's recovery/approval UI ── */}
              <div className="glass-card p-6 border-dashed border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="text-[13px] font-semibold text-amber-300">
                    Recovery Actions
                  </span>
                  <span className="ml-auto text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-full px-2 py-0.5">
                    Stub
                  </span>
                </div>
                <p className="text-[13px] text-white/40 leading-relaxed">
                  Suggested action:{" "}
                  <span className="text-white/70 font-medium">
                    {session.recommended_action.replace(/_/g, " ")}
                  </span>
                </p>
                <div className="mt-4 flex items-center gap-2 text-[12px] text-white/30">
                  <Clock className="h-3.5 w-3.5" />
                  Person 5 — implement approve / edit / send flow here
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
