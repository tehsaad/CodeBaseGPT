import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------- Better Auth tables ----------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ---------- Application rate limiting (chat, search, import) ----------

export const appRateLimit = pgTable("app_rate_limit", {
  key: text("key").primaryKey(),
  windowStart: bigint("window_start", { mode: "number" }).notNull(),
  count: integer("count").notNull(),
});

// ---------- Repositories & indexing ----------

export type RepoStatus = "queued" | "downloading" | "parsing" | "linking" | "ready" | "failed" | "cancelled";

export const repository = pgTable(
  "repository",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    source: text("source").$type<"github" | "zip">().notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    htmlUrl: text("html_url"),
    ref: text("ref"),
    commitSha: text("commit_sha"),
    isPrivate: boolean("is_private").notNull().default(false),
    status: text("status").$type<RepoStatus>().notNull().default("queued"),
    error: text("error"),
    fileCount: integer("file_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    symbolCount: integer("symbol_count").notNull().default(0),
    edgeCount: integer("edge_count").notNull().default(0),
    totalBytes: integer("total_bytes").notNull().default(0),
    totalLines: integer("total_lines").notNull().default(0),
    manifest: jsonb("manifest").$type<{ ecosystems: string[]; frameworks: string[] }>(),
    lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("repository_owner_idx").on(t.ownerId, t.createdAt)],
);

export type JobPhase = "download" | "parse" | "link" | "embed" | "done";

export const indexingJob = pgTable(
  "indexing_job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repository.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").$type<"queued" | "running" | "succeeded" | "failed" | "cancelled">().notNull().default("queued"),
    phase: text("phase").$type<JobPhase>().notNull().default("download"),
    processed: integer("processed").notNull().default(0),
    total: integer("total").notNull().default(0),
    error: text("error"),
    cancelRequested: boolean("cancel_requested").notNull().default(false),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("indexing_job_repo_idx").on(t.repositoryId, t.createdAt)],
);

export const repoFile = pgTable(
  "repo_file",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repository.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    language: text("language"),
    sizeBytes: integer("size_bytes").notNull(),
    lineCount: integer("line_count").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    parseStatus: text("parse_status").$type<"pending" | "parsed" | "unsupported" | "error">().notNull().default("pending"),
    parseError: text("parse_error"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("repo_file_repo_path_uq").on(t.repositoryId, t.path),
    index("repo_file_status_idx").on(t.repositoryId, t.parseStatus),
  ],
);

export type SymbolKind = "function" | "method" | "class" | "interface" | "type" | "enum" | "struct" | "namespace";

export const codeSymbol = pgTable(
  "code_symbol",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repository.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => repoFile.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").$type<SymbolKind>().notNull(),
    parentName: text("parent_name"),
    startLine: integer("start_line").notNull(),
    endLine: integer("end_line").notNull(),
    signature: text("signature"),
    exported: boolean("exported").notNull().default(false),
    complexity: integer("complexity").notNull().default(1),
  },
  (t) => [
    index("code_symbol_file_idx").on(t.fileId),
    index("code_symbol_repo_name_idx").on(t.repositoryId, t.name),
  ],
);

export const fileImport = pgTable(
  "file_import",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repository.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => repoFile.id, { onDelete: "cascade" }),
    specifier: text("specifier").notNull(),
    names: jsonb("names").$type<string[]>().notNull().default([]),
    line: integer("line").notNull(),
    targetFileId: uuid("target_file_id").references(() => repoFile.id, { onDelete: "set null" }),
    kind: text("kind").$type<"internal" | "external" | "unresolved">().notNull().default("unresolved"),
  },
  (t) => [
    index("file_import_source_idx").on(t.fileId),
    index("file_import_target_idx").on(t.targetFileId),
    index("file_import_repo_idx").on(t.repositoryId, t.kind),
  ],
);

export const symbolCall = pgTable(
  "symbol_call",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repository.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => repoFile.id, { onDelete: "cascade" }),
    callerSymbolId: uuid("caller_symbol_id").references(() => codeSymbol.id, { onDelete: "cascade" }),
    calleeName: text("callee_name").notNull(),
    line: integer("line").notNull(),
    calleeSymbolId: uuid("callee_symbol_id").references(() => codeSymbol.id, { onDelete: "set null" }),
  },
  (t) => [
    index("symbol_call_repo_callee_idx").on(t.repositoryId, t.calleeName),
    index("symbol_call_callee_idx").on(t.calleeSymbolId),
    index("symbol_call_caller_idx").on(t.callerSymbolId),
  ],
);

export const EMBEDDING_DIMENSIONS = 768;

export const codeChunk = pgTable(
  "code_chunk",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repository.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => repoFile.id, { onDelete: "cascade" }),
    symbolId: uuid("symbol_id").references(() => codeSymbol.id, { onDelete: "set null" }),
    startLine: integer("start_line").notNull(),
    endLine: integer("end_line").notNull(),
    content: text("content").notNull(),
    searchText: text("search_text").notNull(),
    tsv: tsvector("tsv").generatedAlwaysAs(sql`to_tsvector('simple', search_text)`),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  },
  (t) => [
    index("code_chunk_file_idx").on(t.fileId),
    index("code_chunk_tsv_idx").using("gin", t.tsv),
    index("code_chunk_repo_idx").on(t.repositoryId),
  ],
);

// ---------- Conversations, citations, research ----------

export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repository.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"chat" | "stuck">().notNull(),
    title: text("title").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("conversation_owner_idx").on(t.ownerId, t.updatedAt)],
);

export type StoredCitation = {
  label: string;
  fileId: string;
  path: string;
  startLine: number;
  endLine: number;
  symbol?: string | null;
};

export type StoredWebSource = {
  label: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  publishedAt?: string | null;
};

export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    status: text("status").$type<"complete" | "error" | "insufficient_evidence">().notNull().default("complete"),
    model: text("model"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("message_conversation_idx").on(t.conversationId, t.createdAt)],
);

export const citation = pgTable(
  "citation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"repo" | "web">().notNull(),
    label: text("label").notNull(),
    cited: boolean("cited").notNull().default(false),
    fileId: uuid("file_id").references(() => repoFile.id, { onDelete: "set null" }),
    path: text("path"),
    startLine: integer("start_line"),
    endLine: integer("end_line"),
    symbol: text("symbol"),
    url: text("url"),
    title: text("title"),
    domain: text("domain"),
    snippet: text("snippet"),
    publishedAt: text("published_at"),
  },
  (t) => [index("citation_message_idx").on(t.messageId)],
);

export const webResult = pgTable(
  "web_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversation.id, { onDelete: "cascade" }),
    repositoryId: uuid("repository_id").references(() => repository.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    query: text("query").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    domain: text("domain").notNull(),
    snippet: text("snippet").notNull(),
    publishedAt: text("published_at"),
    saved: boolean("saved").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("web_result_owner_idx").on(t.ownerId, t.saved, t.createdAt)],
);

export const savedAnswer = pgTable(
  "saved_answer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("saved_answer_owner_message_uq").on(t.ownerId, t.messageId)],
);

// ---------- Code Tutor runs ----------

export const codeRun = pgTable(
  "code_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    code: text("code").notNull(),
    stdin: text("stdin").notNull().default(""),
    phase: text("phase").$type<"compile" | "run">().notNull(),
    compileOutput: text("compile_output").notNull().default(""),
    stdout: text("stdout").notNull().default(""),
    stderr: text("stderr").notNull().default(""),
    exitCode: integer("exit_code"),
    timedOut: boolean("timed_out").notNull().default(false),
    truncated: boolean("truncated").notNull().default(false),
    durationMs: integer("duration_ms"),
    createdAt: createdAt(),
  },
  (t) => [index("code_run_owner_idx").on(t.ownerId, t.createdAt)],
);
