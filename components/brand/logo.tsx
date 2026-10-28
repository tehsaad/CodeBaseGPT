export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--primary-fill)" />
      <path d="M11 9.5 6.5 16l4.5 6.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 9.5 25.5 16 21 22.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
      <circle cx="16" cy="11.5" r="2" fill="#fff" />
      <circle cx="13" cy="20" r="2" fill="#fff" />
      <circle cx="19.5" cy="19" r="2" fill="#c4b5fd" />
      <path d="M16 13.5 13.5 18M16 13.5l3 3.6M15 20l2.6-.6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className ?? ""}`}>
      <LogoMark />
      <span>
        CodeBase<span className="text-primary">GPT</span>
      </span>
    </span>
  );
}
