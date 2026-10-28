import { AlertTriangle, Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/client/cn";

export function Badge({ tone = "neutral", className, children }: { tone?: "neutral" | "primary" | "accent" | "info" | "success" | "warning" | "danger"; className?: string; children: ReactNode }) {
  const tones = {
    neutral: "bg-surface-3 text-fg-muted",
    primary: "bg-primary-soft text-primary",
    accent: "bg-accent-soft text-accent",
    info: "bg-info-soft text-info",
    success: "bg-success/12 text-success",
    warning: "bg-warning/12 text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium leading-4", tones[tone], className)}>{children}</span>;
}

export function Panel({ className, children, as: Tag = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" | "aside" }) {
  return <Tag className={cn("rounded-[10px] border border-border bg-surface", className)}>{children}</Tag>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-3/70", className)} />;
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 grid size-11 place-items-center rounded-full bg-surface-2 text-fg-muted">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {children ? <p className="mt-1 max-w-md text-sm text-fg-muted">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Notice({ tone = "info", title, children, action, className }: { tone?: "info" | "warning" | "danger"; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  const Icon = tone === "info" ? Info : AlertTriangle;
  const styles = { info: "border-info/30 bg-info-soft", warning: "border-warning/30 bg-warning/8", danger: "border-danger/30 bg-danger-soft" };
  const iconColor = { info: "text-info", warning: "text-warning", danger: "text-danger" };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border p-3 text-sm", styles[tone], className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconColor[tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">{title}</p>
        {children ? <div className="mt-0.5 text-fg-muted">{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-border-strong bg-surface-2 px-1.5 py-px font-mono text-[11px] text-fg-muted">{children}</kbd>;
}

export function SectionHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
