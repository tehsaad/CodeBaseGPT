import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,var(--primary-soft),transparent_70%)]" />
      <div className="relative w-full max-w-[400px]">
        <Link href="/" className="mb-8 flex justify-center" aria-label="CodeBaseGPT home">
          <Logo className="text-lg" />
        </Link>
        {children}
      </div>
    </div>
  );
}
