import { ArrowRight, BarChart3, Bug, FileCode2, FolderGit2, Globe, GraduationCap, LifeBuoy, Lock, MessageSquareText, Network, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { GitHubIcon } from "@/components/brand/github-icon";
import { Logo } from "@/components/brand/logo";
import { SampleAtlas } from "@/components/marketing/sample-atlas";
import { ButtonLink } from "@/components/ui/button";

const REPO_URL = "https://github.com/tehsaad/CodeBaseGPT";

const SIGNATURE = [
  {
    icon: Network,
    eyebrow: "Codebase Atlas",
    title: "See the architecture that's actually there",
    body: "Tree-sitter parses TypeScript, JavaScript, Python, Java, C and C++ into files, symbols, imports and calls. Expand folders, follow dependencies in either direction, filter by language, and open any node's source at the exact line.",
    points: ["Folder, dependency and symbol-call layouts", "Incoming and outgoing edges highlighted", "Keyboard-friendly outline view of the same graph"],
  },
  {
    icon: MessageSquareText,
    eyebrow: "Cited answers, powered by Gemma",
    title: "Answers you can check in one click",
    body: "Questions run hybrid retrieval over your indexed code, and Gemma answers only from what was retrieved. Every claim carries a file-and-line citation that opens the source. Citations the model invents are flagged, not linked.",
    points: ["“Where is this called?” uses static call sites", "Ask about a node selected in the Atlas", "Says so when the code doesn't show the answer"],
  },
  {
    icon: LifeBuoy,
    eyebrow: "Student Stuck Mode",
    title: "Stuck? Get your code and the web side by side",
    body: "Paste the error. CodeBaseGPT finds the related code in your repository, runs a real web search with the error signature, and explains the likely cause step by step, keeping repository evidence, web sources and its own reasoning visibly separate.",
    points: ["Editable search queries, real source links", "Beginner, intermediate or advanced explanations", "Works repo-only when search is unavailable"],
  },
];

const MORE = [
  { icon: BarChart3, title: "Measured insights", body: "Languages, largest files, most-depended-on modules, import cycles, unresolved imports, and a documented complexity heuristic." },
  { icon: Bug, title: "Debugging walkthroughs", body: "Stack-trace function names guide retrieval; hypotheses are labelled as hypotheses." },
  { icon: ScanSearch, title: "Trace & impact", body: "See which files import a module and which call sites reach a function before you change it." },
];

const STEPS = [
  { icon: FolderGit2, label: "Import", body: "GitHub URL or ZIP" },
  { icon: ScanSearch, label: "Index", body: "Parse, filter, resolve" },
  { icon: Network, label: "Explore", body: "Interactive Atlas" },
  { icon: MessageSquareText, label: "Ask", body: "Cited answers" },
  { icon: GraduationCap, label: "Learn", body: "Unstuck, with sources" },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary-fill focus:px-3 focus:py-2 focus:text-on-primary">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="CodeBaseGPT home"><Logo /></Link>
          <nav aria-label="Main" className="hidden items-center gap-5 text-[13.5px] text-fg-muted md:flex">
            <a href="#features" className="hover:text-fg">Features</a>
            <a href="#how" className="hover:text-fg">How it works</a>
            <a href="#trust" className="hover:text-fg">Evidence & privacy</a>
            <a href={REPO_URL} className="hover:text-fg" target="_blank" rel="noopener noreferrer">Docs</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ButtonLink href="/sign-in" variant="ghost" size="sm">Sign in</ButtonLink>
            <ButtonLink href="/sign-up" variant="primary" size="sm">Get started</ButtonLink>
          </div>
        </div>
      </header>

      <main id="content">
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 h-[520px] bg-[radial-gradient(ellipse_at_center,var(--primary-soft),transparent_65%)]" />
          <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-16 sm:px-6 sm:pt-24">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-fg-muted">
              <Sparkles className="size-3.5 text-accent" aria-hidden /> For students and developers new to a codebase
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[56px]">
              Understand any codebase. <span className="text-primary">With receipts.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-fg-muted">
              Import a repository, explore its real architecture in an interactive Atlas, and ask questions answered from the code itself, with every claim linked to the file and line it came from.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/sign-up" variant="primary" size="lg">Get started <ArrowRight /></ButtonLink>
              <ButtonLink href="#demo" variant="secondary" size="lg"><Network /> Try the sample Atlas</ButtonLink>
            </div>
            <p className="mt-4 text-xs text-fg-subtle">Open source (MIT). Imported code is parsed, never executed.</p>
          </div>
        </section>

        <section id="demo" aria-labelledby="demo-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 sm:px-6">
          <h2 id="demo-title" className="sr-only">Interactive sample</h2>
          <SampleAtlas />
        </section>

        <section id="features" aria-labelledby="features-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary">Three tools, one workflow</p>
          <h2 id="features-title" className="mt-2 max-w-2xl text-[30px] font-semibold tracking-tight">From “where do I even start?” to a fix you understand</h2>
          <div className="mt-12 space-y-14">
            {SIGNATURE.map((f, i) => (
              <article key={f.eyebrow} className="grid gap-6 border-t border-border pt-10 md:grid-cols-[1fr_1.2fr] md:gap-12">
                <div>
                  <span className="font-mono text-xs text-fg-subtle">0{i + 1}</span>
                  <p className="mt-2 flex items-center gap-2 text-sm font-medium text-primary"><f.icon className="size-4" aria-hidden /> {f.eyebrow}</p>
                  <h3 className="mt-2 text-[22px] font-semibold tracking-tight">{f.title}</h3>
                </div>
                <div>
                  <p className="leading-relaxed text-fg-muted">{f.body}</p>
                  <ul className="mt-4 space-y-1.5 text-[14px]">
                    {f.points.map((p) => <li key={p} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{p}</li>)}
                  </ul>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-16 grid gap-px overflow-hidden rounded-[14px] border border-border bg-border sm:grid-cols-3">
            {MORE.map((m) => (
              <div key={m.title} className="bg-surface p-5">
                <m.icon className="size-5 text-fg-muted" aria-hidden />
                <h3 className="mt-3 text-[15px] font-semibold">{m.title}</h3>
                <p className="mt-1 text-[13.5px] text-fg-muted">{m.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="trust" aria-labelledby="trust-title" className="border-y border-border bg-surface/50">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary">Evidence first</p>
              <h2 id="trust-title" className="mt-2 text-[30px] font-semibold tracking-tight">You always know where a statement came from</h2>
              <p className="mt-4 leading-relaxed text-fg-muted">Answers are assembled from three kinds of material, and the interface never lets them blur together.</p>
              <ul className="mt-6 space-y-3">
                <li className="flex gap-3 rounded-lg border border-l-2 border-border border-l-primary bg-surface p-3"><FileCode2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /><div><p className="text-sm font-medium">Repository evidence</p><p className="text-[13px] text-fg-muted">Code retrieved from your index, cited as <span className="font-mono">[C1]</span> with file and line range.</p></div></li>
                <li className="flex gap-3 rounded-lg border border-l-2 border-border border-l-info bg-surface p-3"><Globe className="mt-0.5 size-4 shrink-0 text-info" aria-hidden /><div><p className="text-sm font-medium">Web sources</p><p className="text-[13px] text-fg-muted">Real search results with title, domain, date and link, cited as <span className="font-mono">[W1]</span>.</p></div></li>
                <li className="flex gap-3 rounded-lg border border-l-2 border-border border-l-accent bg-surface p-3"><Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /><div><p className="text-sm font-medium">AI explanation</p><p className="text-[13px] text-fg-muted">Gemma&apos;s reasoning, labelled as such, with inference kept in its own section.</p></div></li>
              </ul>
            </div>
            <div className="lg:pt-10">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold"><ShieldCheck className="size-4 text-success" aria-hidden /> Responsible by default</h3>
              <ul className="mt-4 space-y-3 text-[14px] text-fg-muted">
                <li className="flex gap-2"><Lock className="mt-1 size-3.5 shrink-0" aria-hidden /> Your repositories, conversations and research are private to your account, with ownership checked on every request.</li>
                <li className="flex gap-2"><Lock className="mt-1 size-3.5 shrink-0" aria-hidden /> <span><span className="font-mono">.env</span> files, private keys, dependencies and build output are skipped at import; recognizable tokens are redacted.</span></li>
                <li className="flex gap-2"><Lock className="mt-1 size-3.5 shrink-0" aria-hidden /> Repository files and web pages are treated as untrusted data. Instructions hidden in them are not followed.</li>
                <li className="flex gap-2"><Lock className="mt-1 size-3.5 shrink-0" aria-hidden /> Only the retrieved snippets for a question are sent to the model provider, never the whole repository.</li>
                <li className="flex gap-2"><Lock className="mt-1 size-3.5 shrink-0" aria-hidden /> If the model or search isn&apos;t available, you&apos;re told plainly. Nothing is made up to fill the gap.</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="how" aria-labelledby="how-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 id="how-title" className="text-[30px] font-semibold tracking-tight">How it works</h2>
          <ol className="mt-8 grid gap-3 sm:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.label} className="rounded-[10px] border border-border bg-surface p-4">
                <span className="font-mono text-xs text-fg-subtle">{i + 1}</span>
                <s.icon className="mt-2 size-5 text-primary" aria-hidden />
                <p className="mt-2 text-sm font-semibold">{s.label}</p>
                <p className="text-[13px] text-fg-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-14 flex flex-col items-start justify-between gap-4 rounded-[14px] border border-border bg-surface p-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-semibold">Point it at a repository you&apos;re trying to learn</h3>
              <p className="text-[14px] text-fg-muted">Public GitHub repositories import in seconds. No setup on your machine.</p>
            </div>
            <ButtonLink href="/sign-up" variant="primary" size="lg">Create a free account <ArrowRight /></ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-[13px] text-fg-muted sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="space-y-2">
            <Logo />
            <p className="max-w-xs text-xs text-fg-subtle">Open-source codebase intelligence for learners. MIT licensed. Not affiliated with Google; Gemma is a model family by Google.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2">
            <a href="#features" className="hover:text-fg">Features</a>
            <a href={`${REPO_URL}#readme`} target="_blank" rel="noopener noreferrer" className="hover:text-fg">Documentation</a>
            <a href="#trust" className="hover:text-fg">Privacy</a>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-fg"><GitHubIcon className="size-3.5" /> GitHub</a>
            <Link href="/sign-in" className="hover:text-fg">Sign in</Link>
            <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" className="hover:text-fg">License</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
