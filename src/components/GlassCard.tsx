import { createElement, HTMLAttributes } from "react";

export function GlassCard({
  className = "",
  children,
  as = "div",
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: "div" | "form" | "section" }) {
  return createElement(as, { className: `glass-card p-6 ${className}`, ...rest }, children);
}
