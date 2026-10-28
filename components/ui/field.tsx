import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/client/cn";

const base =
  "w-full rounded-md border border-border-strong bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-subtle transition-colors focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(base, "h-9 max-md:h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(base, "min-h-20 py-2 leading-relaxed", className)} {...props} />;
});

type FieldProps = { label: string; hint?: ReactNode; error?: string | null; children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode; className?: string };

/** Visible label + helper + inline error wired with aria-describedby. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      {children({ id, describedBy: [hintId, errorId].filter(Boolean).join(" ") || undefined, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
