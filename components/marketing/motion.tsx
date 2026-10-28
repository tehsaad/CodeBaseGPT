"use client";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { Children, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribeReduce(cb: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Hydration-safe reduced-motion flag: the server and first client render both assume motion. */
function useReducedMotion() {
  return useSyncExternalStore(subscribeReduce, () => window.matchMedia(REDUCE).matches, () => false);
}

/**
 * Adds `is-in` once the element enters the viewport; CSS (`.rv`, `.rv-line`, `.svg-draw`, `.sep`, …)
 * does the animating. Content is only hidden when the `.js` class is present, so it never stays invisible.
 */
export function Reveal({ children, className, style, as: Tag = "div", threshold = 0.18, id }: { children: ReactNode; className?: string; style?: CSSProperties; as?: "div" | "section" | "article" | "ul" | "ol" | "li" | "header"; threshold?: number; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  const Comp = Tag as "div";
  return (
    <Comp ref={ref as React.RefObject<HTMLDivElement>} id={id} className={`${className ?? ""}${inView ? " is-in" : ""}`} style={style}>
      {children}
    </Comp>
  );
}

/** Background layer that drifts with scroll (reference: y −7%→7%, scale 1.05→1.18). */
export function ParallaxBand({ children, background, className }: { children: ReactNode; background: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-7%", "7%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1.05, 1.18]);
  const frameY = useTransform(scrollYProgress, [0, 0.5], [60, 0]);
  const frameScale = useTransform(scrollYProgress, [0, 0.5], [0.94, 1]);
  return (
    <div ref={ref} className={`relative isolate overflow-hidden ${className ?? ""}`}>
      <motion.div aria-hidden className="absolute inset-0 -z-10" style={reduce ? undefined : { y, scale }}>
        {background}
      </motion.div>
      <motion.div style={reduce ? undefined : { y: frameY, scale: frameScale }}>{children}</motion.div>
    </div>
  );
}

/** Sticky stacking cards: each card pins at 10vh and shrinks to 0.92 as the next one slides over it. */
export function StackDeck({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <div className="space-y-[12vh] pb-[6vh]">
      {items.map((child, i) => (
        <StackSlot key={i} index={i} last={i === items.length - 1}>
          {child}
        </StackSlot>
      ))}
    </div>
  );
}

function StackSlot({ children, index, last }: { children: ReactNode; index: number; last: boolean }) {
  const reduce = useReducedMotion();
  // A sentinel just after this card: as it travels up to the sticky line, the next card covers this one.
  const sentinel = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sentinel, offset: ["start end", "start 10vh"] });
  const progress = useSpring(scrollYProgress, { stiffness: 220, damping: 32, mass: 0.4 });
  const scale = useTransform(progress, [0, 1], [1, 0.92]);
  const dim = useTransform(progress, [0, 1], [0, 0.45]);
  const animate = !reduce && !last;
  return (
    <>
      <motion.div className="sticky origin-top rounded-2xl" style={{ top: `calc(10vh + ${index * 14}px)`, boxShadow: "0 -10px 40px rgba(0,0,0,0.5)", ...(animate ? { scale } : {}) }}>
        {children}
        {animate ? <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl bg-black" style={{ opacity: dim }} /> : null}
      </motion.div>
      <div ref={sentinel} aria-hidden className="h-px" />
    </>
  );
}

/**
 * Exploded 3D card whose rotation and layer depth follow scroll, like the reference's "Decades of defense"
 * panel (rotateY 15°→1°→−26°→12°→20°, layers at translateZ ±40px fading in). Includes the scroll-progress ticks.
 */
export function TiltStack({ base, middle, top, ticks = 4 }: { base: ReactNode; middle: ReactNode; top: ReactNode; ticks?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.5 });
  const rotateY = useTransform(p, [0, 0.3, 0.5, 0.7, 1], [15, 1, -14, 10, 20]);
  const rotateX = useTransform(p, [0, 0.3, 0.5, 0.7, 1], [5, 0.5, 8, -6, -10]);
  const backZ = useTransform(p, [0.15, 0.45], [0, -40]);
  const backOpacity = useTransform(p, [0.15, 0.4], [0, 1]);
  const topZ = useTransform(p, [0.25, 0.55], [0, 46]);
  const topOpacity = useTransform(p, [0.3, 0.5], [0, 1]);
  const midZ = useTransform(p, [0.2, 0.5], [0, 18]);
  const [active, setActive] = useState(0);
  useEffect(() => p.on("change", (v) => setActive(Math.min(ticks - 1, Math.max(0, Math.floor((v - 0.2) * ticks * 1.6))))), [p, ticks]);

  if (reduce) {
    return (
      <div ref={ref} className="space-y-3">
        {base}
        {middle}
        {top}
      </div>
    );
  }
  return (
    <div ref={ref} className="flex items-center justify-center gap-10" style={{ perspective: 1200 }}>
      <motion.div className="relative w-full max-w-sm" style={{ rotateY, rotateX, transformStyle: "preserve-3d" }}>
        <motion.div aria-hidden className="absolute inset-0 rounded-2xl border border-white/10 bg-[#1a1a1a]" style={{ z: backZ, opacity: backOpacity }} />
        <motion.div style={{ z: midZ }}>{base}</motion.div>
        <motion.div className="absolute inset-x-6 bottom-6" style={{ z: midZ }}>{middle}</motion.div>
        <motion.div className="absolute -right-10 -top-24 w-60 max-sm:-right-2 max-sm:-top-28" style={{ z: topZ, opacity: topOpacity }}>{top}</motion.div>
      </motion.div>
      <ol aria-hidden className="hidden flex-col items-center gap-5 lg:flex">
        {Array.from({ length: ticks }, (_, i) => (
          <li key={i} className={`h-6 w-[3px] rounded transition-colors duration-300 ${i === active ? "bg-[var(--lime)]" : "bg-white/20"}`} />
        ))}
      </ol>
    </div>
  );
}

/** Oversized outline word that slides horizontally as the page scrolls. */
export function ScrollWord({ children, className, from = "8%", to = "-14%" }: { children: ReactNode; className?: string; from?: string; to?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], [from, to]);
  return (
    <div ref={ref} className="overflow-hidden">
      <motion.p aria-hidden className={className} style={reduce ? undefined : { x }}>
        {children}
      </motion.p>
    </div>
  );
}
