"use client";
import * as T from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <T.Provider delayDuration={300}>{children}</T.Provider>;
}

export function Tooltip({ label, children, side = "top" }: { label: ReactNode; children: ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="z-50 rounded-md border border-border bg-surface-3 px-2 py-1 text-xs text-fg shadow-overlay">
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
