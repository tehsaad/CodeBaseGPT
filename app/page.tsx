import { ArrowRight, ArrowUpRight, FileCode2, Globe, Sparkles } from "lucide-react";
import { Archivo, Geist_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { GitHubIcon } from "@/components/brand/github-icon";
import { LogoMark } from "@/components/brand/logo";
import { AtlasArt, CitedArt, StuckArt, TutorArt } from "@/components/marketing/art";
import { SampleAtlas } from "@/components/marketing/sample-atlas";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

const REPO_URL = "https://github.com/tehsaad/CodeBaseGPT";

function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-label text-fg-muted ${className}`}>{children}</p>;
}

function PillLink({ href, children, glow }: { href: string; children: ReactNode; glow?: boolean }) {
  return (
    <Link href={href} className={`font-label inline-flex h-11 items-center gap-2 rounded-full px-5 !text-[11px] font-semibold transition-shadow duration-200 ${glow ? "pill-glow" : "pill-dark text-fg hover:border-white/30"}`}>
      {children}
    </Link>
  );
}

function FeatureCard({ art, meta, title, body, tag, wide }: { art: ReactNode; meta: string; title: string; body: string; tag: string; wide?: boolean }) {
  return (
    <article className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface ${wide ? "md:col-span-2" : ""}`}>
      <p className="font-label absolute right-6 top-6 whitespace-pre-line text-right !text-[10px] leading-5 text-fg-subtle">{meta}</p>
      <div className={`px-6 pt-10 ${wide ? "h-72 sm:h-80" : "h-60"}`}>{art}</div>
      <div className="mt-auto flex items-end justify-between gap-4 p-6 pt-2">
        <div>
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-fg-muted">{body}</p>
        </div>
        <p className="font-label shrink-0 !text-[10px] text-fg-subtle">{tag}</p>
      </div>
    </article>
  );
}

function Showcase({ n, icon, title, body, meta, cta, children }: { n: string; icon: ReactNode; title: ReactNode; body: string; meta: [string, string][]; cta: { href: string; label: string }; children: ReactNode }) {
  return (
    <article className="grid overflow-hidden rounded-2xl border border-border bg-surface lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="grid-texture relative flex flex-col p-8 sm:p-10">
        <span aria-hidden className="font-display text-outline pointer-events-none absolute right-6 top-2 select-none text-[120px] font-bold leading-none opacity-50">{n}</span>
        <span className="grid size-10 place-items-center rounded-full border border-border-strong text-primary">{icon}</span>
        <h3 className="font-display mt-8 text-4xl font-semibold leading-[1.02]">{title}</h3>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-fg-muted">{body}</p>
        <dl className="mt-10 grid grid-cols-3 border-y border-border">
          {meta.map(([k, v], i) => (
            <div key={k} className={`py-3 ${i ? "border-l border-border pl-4" : ""}`}>
              <dt className="font-label !text-[9px] text-fg-subtle">{k}</dt>
              <dd className="mt-1 text-[14px]">{v}</dd>
            </div>
          ))}
        </dl>
        <Link href={cta.href} className="font-label mt-8 inline-flex w-fit items-center gap-2 rounded-full border border-primary/50 px-5 py-2.5 !text-[11px] font-semibold text-primary hover:bg-primary-soft">
          {cta.label} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      <div className="relative min-h-[320px] border-t border-border bg-[#080808] lg:border-l lg:border-t-0">{children}</div>
    </article>
  );
}

export default function Landing() {
  return (
    <div className={`landing ${archivo.variable} ${geistMono.variable} min-h-dvh overflow-x-clip`}>
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-primary-fill focus:px-4 focus:py-2 focus:text-on-primary">Skip to content</a>

      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <Link href="/" aria-label="CodeBaseGPT home" className="pill-dark inline-flex h-12 items-center gap-2.5 rounded-full pl-2 pr-4">
          <LogoMark className="size-8" />
          <span className="text-[15px] font-semibold tracking-tight">CodeBaseGPT</span>
        </Link>
        <nav aria-label="Main" className="pill-dark hidden h-12 items-center gap-6 rounded-full px-6 lg:flex">
          {[["#features", "Features"], ["#tutor", "Code Tutor"], ["#trust", "Evidence"], [REPO_URL, "GitHub"]].map(([href, label]) => (
            <a key={label} href={href} className="font-label !text-[10px] text-fg-muted hover:text-fg" {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="font-label hidden !text-[11px] text-fg-muted hover:text-fg sm:inline">Sign in</Link>
          <PillLink href="/sign-up" glow>Get started <ArrowUpRight className="size-3.5" aria-hidden /></PillLink>
        </div>
      </header>

      <main id="content">
        {/* Hero */}
        <section className="relative isolate flex min-h-[94dvh] items-center overflow-hidden pt-24">
          <div aria-hidden className="arc" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_55%_at_68%_62%,rgba(200,241,53,0.16),transparent_70%)]" />
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="border-t border-border pt-4">
              <Label className="text-right !text-[10px]">Open source · MIT · Built for students</Label>
            </div>
            <h1 className="font-display mt-10 text-[clamp(2.6rem,8.2vw,6.4rem)] font-semibold leading-[0.95]">
              Read any codebase
              <span className="block pl-[0.6em] max-sm:pl-[0.3em]">
                like you wrote it<span className="text-[var(--lime)]">.</span>
              </span>
            </h1>
            <div className="mt-12 grid gap-8 border-y border-border py-8 md:grid-cols-[1fr_1fr_auto] md:items-start">
              <span className="hidden md:block" />
              <p className="max-w-sm text-[15px] leading-relaxed text-fg-muted">
                Map a repository&apos;s real architecture, ask Gemma questions answered with file-and-line citations, run small programs, and get unstuck with a tutor that explains your errors.
              </p>
              <a href="#atlas" className="font-label inline-flex items-center gap-2 border-b border-fg/60 pb-1 !text-[11px] text-fg hover:border-[var(--lime)] hover:text-[var(--lime)] md:justify-self-end">
                Explore the Atlas <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            </div>
          </div>
        </section>

        {/* Live sample */}
        <section id="atlas" aria-labelledby="atlas-title" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <h2 id="atlas-title" className="font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-none">
              Codebase <span className="text-outline">Atlas</span>
            </h2>
            <Label className="max-w-xs !normal-case !tracking-normal !text-[13px]">An interactive map built from real imports and calls. Click a file to trace what it depends on and what depends on it.</Label>
          </div>
          <SampleAtlas />
        </section>

        {/* Four tools */}
        <section id="features" aria-labelledby="features-title" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16">
          <Label>What you get</Label>
          <h2 id="features-title" className="font-display mt-3 text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-[1.02]">
            Four tools.
            <br />
            One workflow.
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <FeatureCard wide art={<AtlasArt />} meta={"Tree-sitter · 6 languages\nUp to 400 nodes"} title="Codebase Atlas" body="Folders, files, classes and functions as a navigable map. Every edge is an import or call parsed from the source." tag="Explore" />
            <FeatureCard art={<CitedArt />} meta={"Gemma 4 · cited"} title="Answers with receipts" body="Each claim links to the exact file and lines. Invented citations are flagged, never linked." tag="Ask" />
            <FeatureCard art={<StuckArt />} meta={"Repo + web"} title="Student Stuck Mode" body="Paste the error. We search your code and the web, and keep the two clearly apart." tag="Research" />
            <FeatureCard wide art={<TutorArt />} meta={"Sandboxed · no network\nPython · JS · TS · C · C++ · Java"} title="Code Tutor" body="Run a small program in an isolated sandbox, see the real output, and get a line-by-line explanation of what went wrong." tag="Learn" />
          </div>
        </section>

        {/* Showcases */}
        <section aria-labelledby="proof-title" className="mx-auto max-w-6xl px-6 py-24">
          <h2 id="proof-title" className="font-display mb-12 text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-none">
            Built on <span className="text-outline">evidence</span>
          </h2>
          <div className="space-y-6">
            <Showcase
              n="01"
              icon={<FileCode2 className="size-4" aria-hidden />}
              title={<>Cited<br />answers</>}
              body="Hybrid retrieval finds the definitions, call sites and importers that matter, and Gemma answers only from them."
              meta={[["Retrieval", "Hybrid"], ["Citations", "file:line"], ["Model", "Gemma 4"]]}
              cta={{ href: "/sign-up", label: "Ask your repo" }}
            >
              <div className="space-y-3 p-6 font-mono text-[12.5px] sm:p-8">
                <p className="w-fit rounded-xl bg-white/5 px-3 py-2 font-sans text-[14px]">Where is the session token verified?</p>
                <p className="font-sans text-[14px] leading-relaxed text-fg-muted">
                  <span className="text-fg">readSession</span> recomputes the HMAC of the payload and compares it before checking expiry{" "}
                  <span className="rounded border border-primary/50 bg-primary-soft px-1 text-[11px] text-primary">C1</span>.
                </p>
                <pre className="overflow-x-auto rounded-lg border border-border bg-[#050505] p-3 leading-relaxed text-fg-muted">
                  <span className="text-fg-subtle">15 </span>export function <span className="text-primary">readSession</span>(token) {"{"}{"\n"}
                  <span className="text-fg-subtle">19 </span>  const expected = createHmac(…){"\n"}
                  <span className="text-fg-subtle">20 </span>  if (expected !== mac) return null;{"\n"}
                  <span className="text-fg-subtle">22 </span>  return session.expiresAt &gt; Date.now() …
                </pre>
                <p className="font-label !text-[9px] text-fg-subtle">Example output · sample repository</p>
              </div>
            </Showcase>
            <Showcase
              n="02"
              icon={<Globe className="size-4" aria-hidden />}
              title={<>Stuck,<br />then unstuck</>}
              body="Stack-frame names guide the search through your code; the error signature (with paths, URLs and tokens stripped) goes to the web."
              meta={[["Search", "Tavily / Exa"], ["Levels", "3"], ["Sources", "Linked"]]}
              cta={{ href: "/sign-up", label: "Try Stuck Mode" }}
            >
              <div className="h-full p-4"><StuckArt /></div>
            </Showcase>
          </div>
        </section>

        {/* Tutor */}
        <section id="tutor" aria-labelledby="tutor-title" className="mx-auto grid max-w-6xl scroll-mt-24 items-center gap-12 px-6 py-24 lg:grid-cols-[1fr_auto_1fr]">
          <div className="float-slow mx-auto w-full max-w-sm -rotate-6 rounded-2xl border border-[var(--lime)]/70 bg-[linear-gradient(160deg,rgba(200,241,53,0.16),rgba(12,12,12,0.9)_55%)] p-5 shadow-[0_0_60px_-20px_rgba(200,241,53,0.5)]">
            <div className="flex items-center justify-between">
              <span className="font-label !text-[9px] text-fg-muted">python 3.14</span>
              <span className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">exit 1</span>
            </div>
            <pre className="mt-4 overflow-x-auto font-mono text-[12px] leading-relaxed text-fg-muted">
              <span className="text-fg-subtle">4 </span>for i in range(len(scores) + 1):{"\n"}
              <span className="text-fg-subtle">5 </span><span className="bg-warning/20 text-fg">    total += scores[i]</span>
            </pre>
            <p className="mt-4 font-mono text-[12px] text-danger">IndexError: list index out of range</p>
            <div className="mt-4 rounded-lg border border-white/10 bg-black/40 p-3 text-[13px] leading-relaxed">
              <p className="font-label !text-[9px] text-[var(--lime)]">Tutor · hint</p>
              <p className="mt-1 text-fg-muted">On <span className="text-fg">line 4</span> the loop runs one step too many. What is the last valid index of a 3-item list?</p>
            </div>
          </div>
          <ol aria-hidden className="hidden flex-col items-center gap-5 lg:flex">
            {[0, 1, 2, 3].map((i) => <li key={i} className={`h-6 w-[3px] rounded ${i === 3 ? "bg-[var(--lime)]" : "bg-white/20"}`} />)}
          </ol>
          <div>
            <h2 id="tutor-title" className="font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-[1.02]">
              Run it. Break it.
              <br />
              <span className="text-outline">Learn why.</span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-fg-muted">
              The Code Tutor runs your program in a locked-down sandbox and reads the real output. It explains the error in plain language, points to the exact line, gives you a hint first, and keeps the fix one click away.
            </p>
            <div className="mt-8"><PillLink href="/sign-up" glow>Open the tutor <ArrowUpRight className="size-3.5" aria-hidden /></PillLink></div>
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how-title" className="mx-auto max-w-6xl px-6 py-16">
          <h2 id="how-title" className="sr-only">How it works</h2>
          <ol className="grid border-y border-border sm:grid-cols-5">
            {[["Import", "GitHub URL or ZIP"], ["Index", "Parse · filter · resolve"], ["Explore", "Interactive Atlas"], ["Ask", "Cited answers"], ["Learn", "Run code, get tutored"]].map(([t, d], i) => (
              <li key={t} className={`py-6 sm:px-5 ${i ? "border-t border-border sm:border-l sm:border-t-0" : "sm:pl-0"}`}>
                <p className="font-label !text-[10px] text-[var(--lime)]">0{i + 1}</p>
                <p className="font-display mt-3 text-xl font-semibold">{t}</p>
                <p className="mt-1 text-[13px] text-fg-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Trust */}
        <section id="trust" aria-labelledby="trust-title" className="mx-auto grid max-w-6xl scroll-mt-24 gap-12 px-6 py-24 lg:grid-cols-2">
          <div>
            <h2 id="trust-title" className="font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-[1.02]">
              Not guesses.
              <br />
              <span className="text-outline">Receipts.</span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-fg-muted">Every answer keeps its three ingredients visibly separate, and when the model or search isn&apos;t available you&apos;re told plainly — nothing is made up to fill the gap.</p>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {[
              [<FileCode2 key="a" className="size-4" aria-hidden />, "Repository evidence", "Retrieved code, cited as [C1] with file and line range."],
              [<Globe key="b" className="size-4" aria-hidden />, "Web sources", "Real search results with links, cited as [W1]."],
              [<Sparkles key="c" className="size-4" aria-hidden />, "AI reasoning", "Gemma's explanation, labelled as such, inference kept apart."],
            ].map(([icon, t, d]) => (
              <li key={t as string} className="flex gap-4 py-6">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-border-strong text-[var(--lime)]">{icon}</span>
                <div>
                  <p className="font-display text-lg font-semibold">{t}</p>
                  <p className="mt-1 text-[14px] text-fg-muted">{d}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="font-label !normal-case !tracking-normal !text-[13px] text-fg-muted lg:col-span-2">
            Private by default: repositories and history are owner-scoped · <code className="font-mono">.env</code> files and keys are never indexed · imported repositories are parsed, never executed · Code Tutor programs run in an isolated sandbox with no network.
          </p>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-8 py-16 text-center">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_120%,rgba(200,241,53,0.22),transparent_70%)]" />
            <h2 className="font-display relative text-[clamp(2rem,4.5vw,3.2rem)] font-semibold leading-[1.02]">
              Point it at a repo you&apos;re <span className="text-outline">learning</span>
            </h2>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <PillLink href="/sign-up" glow>Create a free account <ArrowUpRight className="size-3.5" aria-hidden /></PillLink>
              <PillLink href="/sign-in">Sign in</PillLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p aria-hidden className="font-display text-outline select-none text-[clamp(3rem,13vw,10rem)] font-bold leading-none">CODEBASE</p>
          <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-xs text-xs text-fg-subtle">Open-source codebase intelligence for learners. MIT licensed. Not affiliated with Google; Gemma is a model family by Google.</p>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3">
              <a href="#features" className="font-label !text-[10px] text-fg-muted hover:text-fg">Features</a>
              <a href={`${REPO_URL}#readme`} target="_blank" rel="noopener noreferrer" className="font-label !text-[10px] text-fg-muted hover:text-fg">Docs</a>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="font-label inline-flex items-center gap-1.5 !text-[10px] text-fg-muted hover:text-fg"><GitHubIcon className="size-3" /> GitHub</a>
              <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" className="font-label !text-[10px] text-fg-muted hover:text-fg">License</a>
              <Link href="/sign-in" className="font-label !text-[10px] text-fg-muted hover:text-fg">Sign in</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
