"use client";

import { cn } from "@/lib/utils";

type FrictionType = "cart_abandoned" | "payment_friction" | "hesitation" | "delivery_concern";

interface FrictionBadgeProps {
  type: FrictionType;
  className?: string;
}

const CONFIG: Record<
  FrictionType,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  cart_abandoned: {
    label: "Cart Abandoned",
    icon: "🛒",
    color: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
  },
  payment_friction: {
    label: "Payment Friction",
    icon: "💳",
    color: "text-rose-300",
    bg: "bg-rose-500/10",
    border: "border-rose-500/25",
  },
  hesitation: {
    label: "Hesitation",
    icon: "⏱",
    color: "text-violet-300",
    bg: "bg-violet-500/10",
    border: "border-violet-500/25",
  },
  delivery_concern: {
    label: "Delivery Concern",
    icon: "📦",
    color: "text-sky-300",
    bg: "bg-sky-500/10",
    border: "border-sky-500/25",
  },
};

export function FrictionBadge({ type, className }: FrictionBadgeProps) {
  const cfg = CONFIG[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap",
        cfg.bg,
        cfg.border,
        cfg.color,
        className
      )}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
