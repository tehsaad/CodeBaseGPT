import { readFile } from "node:fs/promises";
import path from "node:path";
import { Language, Parser, type Node } from "web-tree-sitter";
import type { SymbolKind } from "@/lib/db/schema";
import type { ParsedLanguage } from "./languages";

export type ExtractedSymbol = {
  name: string;
  kind: SymbolKind;
  parentName: string | null;
  startLine: number;
  endLine: number;
  signature: string;
  exported: boolean;
  complexity: number;
};

export type ImportKind = "module" | "include-local" | "include-system";

export type ExtractedImport = { specifier: string; names: string[]; line: number; kind: ImportKind };

export type ExtractedCall = { calleeName: string; line: number; callerIndex: number | null };

export type FileExtraction = {
  symbols: ExtractedSymbol[];
  imports: ExtractedImport[];
  calls: ExtractedCall[];
  javaPackage: string | null;
  hasErrors: boolean;
};

const GRAMMAR_DIR = path.join(process.cwd(), "lib", "code-intelligence", "grammars");

let initPromise: Promise<void> | undefined;
const languages = new Map<ParsedLanguage, Promise<Language>>();

async function getParser(lang: ParsedLanguage) {
  initPromise ??= Parser.init({ locateFile: () => path.join(GRAMMAR_DIR, "web-tree-sitter.wasm") });
  await initPromise;
  if (!languages.has(lang)) {
    languages.set(
      lang,
      readFile(path.join(GRAMMAR_DIR, `tree-sitter-${lang}.wasm`)).then((buf) => Language.load(new Uint8Array(buf))),
    );
  }
  const parser = new Parser();
  parser.setLanguage(await languages.get(lang)!);
  return parser;
}

const DECISION_TYPES = new Set([
  "if_statement", "elif_clause", "for_statement", "for_in_statement", "enhanced_for_statement",
  "while_statement", "do_statement", "switch_case", "case_statement", "switch_label", "catch_clause",
  "except_clause", "conditional_expression", "ternary_expression", "boolean_operator", "for_range_loop",
]);

const line = (n: Node) => n.startPosition.row + 1;
const endLine = (n: Node) => n.endPosition.row + 1;
const signatureOf = (n: Node) => n.text.split("\n")[0].trim().slice(0, 160);
const unquote = (s: string) => s.replace(/^['"`<]|['"`>]$/g, "");

function complexityOf(node: Node) {
  let score = 1;
  const stack: Node[] = [node];
  while (stack.length) {
    const n = stack.pop()!;
    if (DECISION_TYPES.has(n.type)) score++;
    else if (n.type === "binary_expression") {
      const op = n.childForFieldName("operator")?.text ?? n.child(1)?.text;
      if (op === "&&" || op === "||" || op === "??") score++;
    }
    for (let i = 0; i < n.namedChildCount; i++) stack.push(n.namedChild(i)!);
  }
  return score;
}

/** Extracts the identifier from a C/C++ declarator chain (pointer/reference/qualified). */
function cDeclaratorName(n: Node | null): { name: string; scope: string | null } | null {
  let cur: Node | null = n;
  while (cur) {
    if (cur.type === "identifier" || cur.type === "field_identifier" || cur.type === "operator_name" || cur.type === "destructor_name") {
      return { name: cur.text, scope: null };
    }
    if (cur.type === "qualified_identifier") {
      const parts = cur.text.split("::");
      return { name: parts.pop()!, scope: parts.join("::") || null };
    }
    cur = cur.childForFieldName("declarator") ?? cur.namedChild(0);
    if (cur && cur.type === "parameter_list") return null;
  }
  return null;
}

function calleeName(n: Node, lang: ParsedLanguage): string | null {
  if (lang === "java" && n.type === "method_invocation") return n.childForFieldName("name")?.text ?? null;
  const fn = n.childForFieldName("function");
  if (!fn) return null;
  switch (fn.type) {
    case "identifier":
      return fn.text;
    case "member_expression":
      return fn.childForFieldName("property")?.text ?? null;
    case "attribute":
      return fn.childForFieldName("attribute")?.text ?? null;
    case "field_expression":
      return fn.childForFieldName("field")?.text ?? null;
    case "qualified_identifier":
    case "scoped_identifier":
      return fn.text.split("::").pop() ?? null;
    default:
      return null;
  }
}

const CALL_TYPES = new Set(["call_expression", "call", "method_invocation"]);

export async function extract(source: string, lang: ParsedLanguage): Promise<FileExtraction> {
  const parser = await getParser(lang);
  const tree = parser.parse(source);
  if (!tree) throw new Error("Parser returned no tree");
  const out: FileExtraction = { symbols: [], imports: [], calls: [], javaPackage: null, hasErrors: tree.rootNode.hasError };

  const addSymbol = (node: Node, name: string, kind: SymbolKind, parentName: string | null, exported: boolean) => {
    const isCallable = kind === "function" || kind === "method";
    out.symbols.push({
      name,
      kind,
      parentName,
      startLine: line(node),
      endLine: endLine(node),
      signature: signatureOf(node),
      exported,
      complexity: isCallable ? complexityOf(node) : 1,
    });
    return out.symbols.length - 1;
  };

  type Ctx = { parent: string | null; caller: number | null; exported: boolean; inBody: boolean };

  const visit = (node: Node, ctx: Ctx) => {
    let next: Ctx = ctx;
    const t = node.type;

    if (CALL_TYPES.has(t)) {
      const name = calleeName(node, lang);
      if (name) {
        if ((lang === "javascript" || lang === "typescript" || lang === "tsx") && name === "require") {
          const arg = node.childForFieldName("arguments")?.namedChild(0);
          if (arg?.type === "string") out.imports.push({ specifier: unquote(arg.text), names: [], line: line(node), kind: "module" });
        } else if (name !== "import") {
          out.calls.push({ calleeName: name, line: line(node), callerIndex: ctx.caller });
        }
      }
      if ((lang === "javascript" || lang === "typescript" || lang === "tsx") && node.childForFieldName("function")?.type === "import") {
        const arg = node.childForFieldName("arguments")?.namedChild(0);
        if (arg?.type === "string") out.imports.push({ specifier: unquote(arg.text), names: [], line: line(node), kind: "module" });
      }
    }

    if (lang === "typescript" || lang === "tsx" || lang === "javascript") {
      if (t === "import_statement" || (t === "export_statement" && node.childForFieldName("source"))) {
        const src = node.childForFieldName("source");
        if (src) {
          const names: string[] = [];
          for (const id of node.descendantsOfType(["import_specifier", "export_specifier"])) {
            const n = id?.childForFieldName("name")?.text;
            if (n) names.push(n);
          }
          const clause = node.namedChildren.find((c) => c?.type === "import_clause");
          const def = clause?.namedChildren.find((c) => c?.type === "identifier");
          if (def) names.push("default");
          out.imports.push({ specifier: unquote(src.text), names, line: line(node), kind: "module" });
        }
        return;
      }
      if (t === "export_statement") next = { ...ctx, exported: true };
      if (!ctx.inBody) {
        if (t === "function_declaration" || t === "generator_function_declaration") {
          const name = node.childForFieldName("name")?.text;
          if (name) {
            const idx = addSymbol(node, name, "function", ctx.parent, ctx.exported);
            next = { ...ctx, caller: idx, inBody: true, exported: false };
          }
        } else if (t === "class_declaration" || t === "abstract_class_declaration" || t === "class") {
          const name = node.childForFieldName("name")?.text;
          if (name) {
            const idx = addSymbol(node, name, "class", ctx.parent, ctx.exported);
            next = { parent: name, caller: idx, exported: false, inBody: false };
          }
        } else if (t === "method_definition" && ctx.parent) {
          const name = node.childForFieldName("name")?.text;
          if (name) {
            const idx = addSymbol(node, name, "method", ctx.parent, false);
            next = { ...ctx, caller: idx, inBody: true };
          }
        } else if (t === "interface_declaration") {
          const name = node.childForFieldName("name")?.text;
          if (name) addSymbol(node, name, "interface", ctx.parent, ctx.exported);
          return;
        } else if (t === "type_alias_declaration") {
          const name = node.childForFieldName("name")?.text;
          if (name) addSymbol(node, name, "type", ctx.parent, ctx.exported);
          return;
        } else if (t === "enum_declaration") {
          const name = node.childForFieldName("name")?.text;
          if (name) addSymbol(node, name, "enum", ctx.parent, ctx.exported);
          return;
        } else if (t === "variable_declarator") {
          const value = node.childForFieldName("value");
          const name = node.childForFieldName("name");
          if (name?.type === "identifier" && value && ["arrow_function", "function_expression", "function"].includes(value.type)) {
            const decl = node.parent?.parent?.type === "export_statement" ? node.parent.parent : (node.parent ?? node);
            const idx = addSymbol(decl, name.text, "function", ctx.parent, ctx.exported);
            next = { ...ctx, caller: idx, inBody: true, exported: false };
          }
        } else if (t === "public_field_definition" && ctx.parent) {
          const value = node.childForFieldName("value");
          const name = node.childForFieldName("name")?.text;
          if (name && value && ["arrow_function", "function_expression"].includes(value.type)) {
            const idx = addSymbol(node, name, "method", ctx.parent, false);
            next = { ...ctx, caller: idx, inBody: true };
          }
        }
      }
    } else if (lang === "python") {
      if (t === "import_statement") {
        for (const n of node.childrenForFieldName("name")) {
          if (!n) continue;
          const dotted = n.type === "aliased_import" ? n.childForFieldName("name")?.text : n.text;
          if (dotted) out.imports.push({ specifier: dotted, names: [], line: line(node), kind: "module" });
        }
        return;
      }
      if (t === "import_from_statement") {
        const mod = node.childForFieldName("module_name")?.text;
        const names = node
          .childrenForFieldName("name")
          .map((n) => (n?.type === "aliased_import" ? n.childForFieldName("name")?.text : n?.text))
          .filter((x): x is string => Boolean(x));
        if (mod) out.imports.push({ specifier: mod, names, line: line(node), kind: "module" });
        return;
      }
      if (!ctx.inBody) {
        const target = t === "decorated_definition" ? node.childForFieldName("definition") : null;
        if (target) {
          visitDefinition(target, node, ctx);
          return;
        }
        if (t === "function_definition" || t === "class_definition") {
          visitDefinition(node, node, ctx);
          return;
        }
      }
    } else if (lang === "java") {
      if (t === "package_declaration") {
        out.javaPackage = node.namedChild(0)?.text ?? null;
        return;
      }
      if (t === "import_declaration") {
        const text = node.text.replace(/^import\s+(static\s+)?/, "").replace(/;\s*$/, "").trim();
        out.imports.push({ specifier: text, names: [text.split(".").pop()!], line: line(node), kind: "module" });
        return;
      }
      const kinds: Record<string, SymbolKind> = {
        class_declaration: "class",
        interface_declaration: "interface",
        enum_declaration: "enum",
        record_declaration: "class",
        annotation_type_declaration: "interface",
      };
      if (kinds[t]) {
        const name = node.childForFieldName("name")?.text;
        if (name) {
          const isPublic = /\bpublic\b/.test(node.namedChildren.find((c) => c?.type === "modifiers")?.text ?? "");
          const idx = addSymbol(node, name, kinds[t], ctx.parent, isPublic);
          next = { parent: name, caller: idx, exported: false, inBody: false };
        }
      } else if ((t === "method_declaration" || t === "constructor_declaration") && !ctx.inBody) {
        const name = node.childForFieldName("name")?.text;
        if (name) {
          const isPublic = /\bpublic\b/.test(node.namedChildren.find((c) => c?.type === "modifiers")?.text ?? "");
          const idx = addSymbol(node, name, "method", ctx.parent, isPublic);
          next = { ...ctx, caller: idx, inBody: true };
        }
      }
    } else {
      // C / C++
      if (t === "preproc_include") {
        const p = node.childForFieldName("path");
        if (p) {
          out.imports.push({
            specifier: unquote(p.text),
            names: [],
            line: line(node),
            kind: p.type === "system_lib_string" ? "include-system" : "include-local",
          });
        }
        return;
      }
      if (!ctx.inBody) {
        if (t === "function_definition") {
          const decl = cDeclaratorName(node.childForFieldName("declarator"));
          if (decl) {
            const parent = decl.scope ?? ctx.parent;
            const isStatic = node.namedChildren.some((c) => c?.type === "storage_class_specifier" && c.text === "static");
            const idx = addSymbol(node, decl.name, parent ? "method" : "function", parent, !isStatic);
            next = { ...ctx, caller: idx, inBody: true };
          }
        } else if ((t === "struct_specifier" || t === "class_specifier" || t === "union_specifier") && node.childForFieldName("body")) {
          const name = node.childForFieldName("name")?.text;
          if (name) {
            const idx = addSymbol(node, name, t === "class_specifier" ? "class" : "struct", ctx.parent, true);
            next = { parent: name, caller: idx, exported: false, inBody: false };
          }
        } else if (t === "enum_specifier" && node.childForFieldName("body")) {
          const name = node.childForFieldName("name")?.text;
          if (name) addSymbol(node, name, "enum", ctx.parent, true);
        } else if (t === "namespace_definition") {
          const name = node.childForFieldName("name")?.text;
          if (name) addSymbol(node, name, "namespace", ctx.parent, true);
        }
      }
    }

    for (let i = 0; i < node.namedChildCount; i++) visit(node.namedChild(i)!, next);
  };

  const visitDefinition = (def: Node, outer: Node, ctx: Ctx) => {
    const name = def.childForFieldName("name")?.text;
    if (!name) return;
    if (def.type === "class_definition") {
      const idx = addSymbol(outer, name, "class", ctx.parent, !name.startsWith("_"));
      const body = def.childForFieldName("body");
      if (body) for (let i = 0; i < body.namedChildCount; i++) visit(body.namedChild(i)!, { parent: name, caller: idx, exported: false, inBody: false });
      return;
    }
    const kind: SymbolKind = ctx.parent ? "method" : "function";
    const idx = addSymbol(outer, name, kind, ctx.parent, !name.startsWith("_"));
    const body = def.childForFieldName("body");
    if (body) visit(body, { ...ctx, caller: idx, inBody: true });
  };

  visit(tree.rootNode, { parent: null, caller: null, exported: false, inBody: false });
  tree.delete();
  parser.delete();
  return out;
}
