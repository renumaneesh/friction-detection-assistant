"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import type { AtRiskSession } from "@/lib/types";

const FLAG_COLORS: Record<string, string> = {
  cart_abandoned: "#F59E0B",
  payment_friction: "#F43F5E",
  hesitation: "#A78BFA",
  delivery_concern: "#38BDF8",
};

const FLAG_LABELS: Record<string, string> = {
  cart_abandoned: "Cart Abandoned",
  payment_friction: "Payment Friction",
  hesitation: "Hesitation",
  delivery_concern: "Delivery Concern",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function GlassTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="glass-card px-4 py-3 text-sm">
      <p className="font-medium text-white">{FLAG_LABELS[name] ?? name}</p>
      <p className="text-white/60 mt-0.5">
        <span className="font-semibold text-white">{value}</span> sessions
      </p>
    </div>
  );
}

interface FrictionChartProps {
  sessions: AtRiskSession[];
}

export function FrictionChart({ sessions }: FrictionChartProps) {
  // Count each flag type across all sessions (a session with 2 flags counts toward both)
  const counts: Record<string, number> = {
    cart_abandoned: 0,
    payment_friction: 0,
    hesitation: 0,
    delivery_concern: 0,
  };

  for (const session of sessions) {
    for (const flag of session.friction_flags) {
      counts[flag.type] = (counts[flag.type] ?? 0) + 1;
    }
  }

  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="glass-card p-6"
    >
      <div className="mb-6">
        <h2 className="font-serif text-xl text-white/90">Friction Signal Distribution</h2>
        <p className="text-[13px] text-white/40 mt-1">
          Sessions per friction type — a session with multiple flags counts in each category
        </p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barSize={44} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tickFormatter={(v) => FLAG_LABELS[v] ?? v}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<GlassTooltip />}
            cursor={{ fill: "rgba(255,255,255,0.04)", radius: 4 }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={FLAG_COLORS[entry.name] ?? "#6366F1"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: FLAG_COLORS[entry.name] }}
            />
            <span className="text-[12px] text-white/50">{FLAG_LABELS[entry.name]}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
