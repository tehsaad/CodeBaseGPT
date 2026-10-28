"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/client/cn";

/** Side sheet (right on desktop, bottom on mobile) with focus trap and Escape-to-close. */
export function Sheet({ open, onOpenChange, title, description, children, side = "right", className, modal = true }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  side?: "right" | "left";
  className?: string;
  modal?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <Dialog.Portal>
        {modal ? <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in" /> : null}
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col border-border bg-surface shadow-overlay outline-none",
            "max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[88dvh] max-md:rounded-t-2xl max-md:border-t",
            side === "right" ? "md:inset-y-0 md:right-0 md:w-[min(760px,92vw)] md:border-l" : "md:inset-y-0 md:left-0 md:w-72 md:border-r",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-sm font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 truncate text-xs text-fg-muted">{description}</Dialog.Description> : <Dialog.Description className="sr-only">Details panel</Dialog.Description>}
            </div>
            <Dialog.Close className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg max-md:size-11" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
