"use client";

import { cn } from "@/lib/utils";

interface RiskTierBadgeProps {
  tier: "low" | "high";
  className?: string;
}

export function RiskTierBadge({ tier, className }: RiskTierBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
        tier === "low"
          ? "bg-teal-500/10 border-teal-500/25 text-teal-300"
          : "bg-amber-500/10 border-amber-500/30 text-amber-300",
        className
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tier === "low" ? "bg-teal-400" : "bg-amber-400 animate-pulse"
        )}
        aria-hidden="true"
      />
      {tier === "low" ? "Auto" : "Needs Approval"}
    </span>
  );
}
