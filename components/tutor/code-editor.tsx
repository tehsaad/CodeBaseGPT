"use client";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { EditorSelection, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import type { RunLanguage } from "@/lib/runner/languages";

const setFlash = StateEffect.define<{ from: number; to: number } | null>();
const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setFlash)) {
        if (!e.value) return Decoration.none;
        const builder: ReturnType<ReturnType<typeof Decoration.line>["range"]>[] = [];
        for (let l = e.value.from; l <= e.value.to; l++) {
          const line = tr.state.doc.line(l);
          builder.push(Decoration.line({ class: "cm-flash-line" }).range(line.from));
        }
        return Decoration.set(builder);
      }
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const theme = EditorView.theme({
  "&": { backgroundColor: "var(--code-bg)", color: "var(--fg)", fontSize: "13px", height: "100%" },
  ".cm-scroller": { fontFamily: "var(--font-jetbrains), ui-monospace, monospace", lineHeight: "1.6" },
  ".cm-gutters": { backgroundColor: "var(--code-bg)", color: "var(--fg-subtle)", border: "none", borderRight: "1px solid var(--border)" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--surface-3) 45%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--fg)" },
  ".cm-cursor": { borderLeftColor: "var(--primary)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--primary-soft) !important" },
  ".cm-flash-line": { backgroundColor: "color-mix(in srgb, var(--warning) 18%, transparent)", boxShadow: "inset 3px 0 0 var(--warning)" },
  "&.cm-focused": { outline: "none" },
});

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: "var(--primary)" },
  { tag: [t.string, t.special(t.string)], color: "var(--success)" },
  { tag: [t.number, t.bool, t.null], color: "var(--warning)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--fg-subtle)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--info)" },
  { tag: [t.typeName, t.className], color: "var(--fg)", fontWeight: "600" },
  { tag: [t.definition(t.variableName)], color: "var(--fg)" },
]);

const LANG = { python: () => python(), javascript: () => javascript(), typescript: () => javascript({ typescript: true }), c: () => cpp(), cpp: () => cpp(), java: () => java() } satisfies Record<RunLanguage, () => unknown>;

export type CodeEditorHandle = { flashLines: (from: number, to?: number) => void };

export const CodeEditor = forwardRef<CodeEditorHandle, { value: string; onChange: (v: string) => void; language: RunLanguage; label: string }>(function CodeEditor({ value, onChange, language, label }, ref) {
  const cm = useRef<ReactCodeMirrorRef>(null);
  useImperativeHandle(ref, () => ({
    flashLines(from, to = from) {
      const view = cm.current?.view;
      if (!view) return;
      const max = view.state.doc.lines;
      const a = Math.min(Math.max(1, from), max);
      const b = Math.min(Math.max(a, to), max);
      view.dispatch({
        effects: [setFlash.of({ from: a, to: b }), EditorView.scrollIntoView(view.state.doc.line(a).from, { y: "center" })],
        selection: EditorSelection.cursor(view.state.doc.line(a).from),
      });
      view.focus();
    },
  }));
  const extensions = useMemo(() => [LANG[language](), theme, syntaxHighlighting(highlight), flashField, indentUnit.of("    "), EditorView.contentAttributes.of({ "aria-label": label })], [language, label]);
  return (
    <CodeMirror
      ref={cm}
      value={value}
      onChange={(v) => {
        onChange(v);
        cm.current?.view?.dispatch({ effects: setFlash.of(null) });
      }}
      extensions={extensions as never}
      theme="none"
      height="100%"
      basicSetup={{ foldGutter: false, highlightActiveLine: true, autocompletion: false, searchKeymap: true }}
      className="h-full"
    />
  );
});
