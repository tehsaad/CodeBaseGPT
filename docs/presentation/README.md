# CodeBaseGPT presentation

An animated four-slide web deck and a complete PowerPoint presentation, in the landing page's theme (`#050505`, lime `#c8f135`, Archivo, IBM Plex Sans, Geist Mono).

- **`CodeBaseGPT.pptx`**: the complete 13-slide PowerPoint deck (problem, the six tools, how it works, Atlas, Ask, Change impact, onboarding, Code Tutor, architecture, security, verified quality, close). Built in the site’s theme with real product screenshots, animated GIF motion graphics (repository graph, indexing pipeline, cited answer, tutor loop), fade transitions and staggered entrance animations that play automatically. Speaker notes on every slide. Headings use Arial and labels Courier New so it renders the same on any computer. Product screenshots come from a local build using the project’s test repository; AI text in them comes from the test stand-in model.
- **`index.html`**: self-contained presentation. Open it in a browser (fonts load from Google Fonts). `→`/`Space`/click = next, `←` = previous, `Home`/`End`, and `#3` in the URL opens slide 3. Looping motion graphics run in sandboxed iframes; entrances replay each time a slide is shown and are skipped under `prefers-reduced-motion`.
- **`source/`**: the original slide files from the Claude Slides artifact (`deck.json` plus one HTML file per slide, with speaker notes in each slide's `<aside>`). `index.html` was generated from these.

| # | Slide | Motion |
|---|---|---|
| 1 | CodeBaseGPT: understand any codebase, every answer cites its code | Folder graph draws itself; data packets flow along imports |
| 2 | From repository to map: Import → Parse → Index → Explore | A packet travels the pipeline and lights each stage |
| 3 | Answers that show their sources: Ask and Code Tutor | Cited answer streams in (an invented label is struck through); Run → Explain → Fix → Verify loop |
| 4 | Built to be trusted | Verified numbers pop in with progress bars |

Figures on slide 4 were measured on 2026-10-28/29: 104 unit and integration tests, 14 Playwright browser tests, 0 axe WCAG 2.1 AA violations on key pages in both themes. Update them if the test suite changes.
