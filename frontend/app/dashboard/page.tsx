import { Suspense } from "react";
import { getAtRiskSessions } from "@/lib/api";
import { aggregateRevenueAtRisk } from "@/lib/aggregate";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { FrictionChart } from "@/components/dashboard/FrictionChart";
import { SessionsTable } from "@/components/dashboard/SessionsTable";
import { Activity, Radio, Clock } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Friction Radar — Live Dashboard",
  description: "Real-time AI-powered customer journey friction detection and recovery.",
};

export const dynamic = "force-dynamic";

function LoadingCard() {
  return (
    <div className="glass-card p-6 animate-pulse">
      <div className="h-4 w-1/3 bg-white/10 rounded mb-4" />
      <div className="h-10 w-1/2 bg-white/08 rounded" />
    </div>
  );
}

export default async function DashboardPage() {
  const sessions = await getAtRiskSessions();
  const summary = aggregateRevenueAtRisk(sessions);

  const now = new Date();
  const timeLabel = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10 xl:px-14 max-w-[1600px] mx-auto">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="mb-10">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            {/* Live status pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/25 bg-teal-500/10 px-3 py-1 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
              </span>
              <span className="text-[12px] font-medium text-teal-300">Live · Updating every 30s</span>
            </div>

            <h1 className="font-serif text-5xl sm:text-6xl text-white leading-none tracking-tight">
              Friction Radar
            </h1>
            <p className="mt-3 text-white/50 text-[15px] max-w-xl leading-relaxed">
              <span className="text-white/80 font-medium">{summary.session_count} at-risk sessions</span>
              {" "}detected in the last 2 hours —{" "}
              <span className="text-white/80 font-medium">
                {sessions.filter((s) => s.risk_tier === "high").length} high-risk
              </span>{" "}
              require human approval.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start mt-2">
            <div className="glass-card px-4 py-2 flex items-center gap-2 text-[13px] text-white/50">
              <Clock className="h-4 w-4" />
              <span>as of {timeLabel}</span>
            </div>
            <div className="glass-card px-4 py-2 flex items-center gap-2 text-[13px] text-white/50">
              <Radio className="h-4 w-4 text-indigo-400" />
              <span>Tier 3 Dashboard</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </header>

      {/* ── Summary cards ──────────────────────────────────────────── */}
      <section aria-label="Summary metrics" className="mb-8">
        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <LoadingCard key={i} />)}
            </div>
          }
        >
          <SummaryCards summary={summary} sessions={sessions} />
        </Suspense>
      </section>

      {/* ── Chart ──────────────────────────────────────────────────── */}
      <section aria-label="Friction signal distribution" className="mb-8">
        <FrictionChart sessions={sessions} />
      </section>

      {/* ── Sessions table ─────────────────────────────────────────── */}
      <section aria-label="At-risk sessions table">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="h-5 w-5 text-white/40" />
          <h2 className="font-serif text-2xl text-white/90">At-Risk Sessions</h2>
          <span className="ml-2 text-[12px] bg-white/08 border border-white/10 rounded-full px-2.5 py-1 text-white/50">
            {sessions.length} total
          </span>
        </div>
        <SessionsTable sessions={sessions} />
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="mt-16 pb-6 flex items-center justify-between text-[12px] text-white/25">
        <span>Friction Detection &amp; Recovery Assistant · Tier 3 Dashboard</span>
        <span>Powered by Gemini · TCS Hackathon 2026</span>
      </footer>
    </main>
  );
}
