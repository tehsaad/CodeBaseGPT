CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"cited" boolean DEFAULT false NOT NULL,
	"file_id" uuid,
	"path" text,
	"start_line" integer,
	"end_line" integer,
	"symbol" text,
	"url" text,
	"title" text,
	"domain" text,
	"snippet" text,
	"published_at" text
);
--> statement-breakpoint
CREATE TABLE "code_chunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"symbol_id" uuid,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL,
	"content" text NOT NULL,
	"search_text" text NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', search_text)) STORED,
	"embedding" vector(768)
);
--> statement-breakpoint
CREATE TABLE "code_symbol" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"parent_name" text,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL,
	"signature" text,
	"exported" boolean DEFAULT false NOT NULL,
	"complexity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"repository_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_import" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"specifier" text NOT NULL,
	"names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"line" integer NOT NULL,
	"target_file_id" uuid,
	"kind" text DEFAULT 'unresolved' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexing_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"phase" text DEFAULT 'download' NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"error" text,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"lease_until" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'complete' NOT NULL,
	"model" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "repo_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"path" text NOT NULL,
	"language" text,
	"size_bytes" integer NOT NULL,
	"line_count" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"parse_status" text DEFAULT 'pending' NOT NULL,
	"parse_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repository" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"source" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"html_url" text,
	"ref" text,
	"commit_sha" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"file_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"symbol_count" integer DEFAULT 0 NOT NULL,
	"edge_count" integer DEFAULT 0 NOT NULL,
	"total_bytes" integer DEFAULT 0 NOT NULL,
	"total_lines" integer DEFAULT 0 NOT NULL,
	"manifest" jsonb,
	"last_indexed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_answer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"message_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "symbol_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"caller_symbol_id" uuid,
	"callee_name" text NOT NULL,
	"line" integer NOT NULL,
	"callee_symbol_id" uuid
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"conversation_id" uuid,
	"repository_id" uuid,
	"provider" text NOT NULL,
	"query" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"snippet" text NOT NULL,
	"published_at" text,
	"saved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_file_id_repo_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."repo_file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_chunk" ADD CONSTRAINT "code_chunk_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_chunk" ADD CONSTRAINT "code_chunk_file_id_repo_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."repo_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_chunk" ADD CONSTRAINT "code_chunk_symbol_id_code_symbol_id_fk" FOREIGN KEY ("symbol_id") REFERENCES "public"."code_symbol"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_symbol" ADD CONSTRAINT "code_symbol_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_symbol" ADD CONSTRAINT "code_symbol_file_id_repo_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."repo_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_import" ADD CONSTRAINT "file_import_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_import" ADD CONSTRAINT "file_import_file_id_repo_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."repo_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_import" ADD CONSTRAINT "file_import_target_file_id_repo_file_id_fk" FOREIGN KEY ("target_file_id") REFERENCES "public"."repo_file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexing_job" ADD CONSTRAINT "indexing_job_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indexing_job" ADD CONSTRAINT "indexing_job_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_file" ADD CONSTRAINT "repo_file_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository" ADD CONSTRAINT "repository_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_answer" ADD CONSTRAINT "saved_answer_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_answer" ADD CONSTRAINT "saved_answer_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_call" ADD CONSTRAINT "symbol_call_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_call" ADD CONSTRAINT "symbol_call_file_id_repo_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."repo_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_call" ADD CONSTRAINT "symbol_call_caller_symbol_id_code_symbol_id_fk" FOREIGN KEY ("caller_symbol_id") REFERENCES "public"."code_symbol"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symbol_call" ADD CONSTRAINT "symbol_call_callee_symbol_id_code_symbol_id_fk" FOREIGN KEY ("callee_symbol_id") REFERENCES "public"."code_symbol"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_result" ADD CONSTRAINT "web_result_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_result" ADD CONSTRAINT "web_result_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_result" ADD CONSTRAINT "web_result_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "citation_message_idx" ON "citation" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "code_chunk_file_idx" ON "code_chunk" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "code_chunk_tsv_idx" ON "code_chunk" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "code_chunk_repo_idx" ON "code_chunk" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "code_symbol_file_idx" ON "code_symbol" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "code_symbol_repo_name_idx" ON "code_symbol" USING btree ("repository_id","name");--> statement-breakpoint
CREATE INDEX "conversation_owner_idx" ON "conversation" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "file_import_source_idx" ON "file_import" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "file_import_target_idx" ON "file_import" USING btree ("target_file_id");--> statement-breakpoint
CREATE INDEX "file_import_repo_idx" ON "file_import" USING btree ("repository_id","kind");--> statement-breakpoint
CREATE INDEX "indexing_job_repo_idx" ON "indexing_job" USING btree ("repository_id","created_at");--> statement-breakpoint
CREATE INDEX "message_conversation_idx" ON "message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repo_file_repo_path_uq" ON "repo_file" USING btree ("repository_id","path");--> statement-breakpoint
CREATE INDEX "repo_file_status_idx" ON "repo_file" USING btree ("repository_id","parse_status");--> statement-breakpoint
CREATE INDEX "repository_owner_idx" ON "repository" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_answer_owner_message_uq" ON "saved_answer" USING btree ("owner_id","message_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "symbol_call_repo_callee_idx" ON "symbol_call" USING btree ("repository_id","callee_name");--> statement-breakpoint
CREATE INDEX "symbol_call_callee_idx" ON "symbol_call" USING btree ("callee_symbol_id");--> statement-breakpoint
CREATE INDEX "symbol_call_caller_idx" ON "symbol_call" USING btree ("caller_symbol_id");--> statement-breakpoint
CREATE INDEX "web_result_owner_idx" ON "web_result" USING btree ("owner_id","saved","created_at");