CREATE TABLE "learning_progress" (
	"owner_id" text NOT NULL,
	"repository_id" uuid NOT NULL,
	"task_id" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_artifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"data" jsonb,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"used_labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"indexed_at" timestamp with time zone,
	"edited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"path" text,
	"start_line" integer,
	"end_line" integer,
	"file_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_artifact" ADD CONSTRAINT "repo_artifact_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_artifact" ADD CONSTRAINT "repo_artifact_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_note" ADD CONSTRAINT "repo_note_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_note" ADD CONSTRAINT "repo_note_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "learning_progress_uq" ON "learning_progress" USING btree ("owner_id","repository_id","task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repo_artifact_repo_kind_uq" ON "repo_artifact" USING btree ("repository_id","kind");--> statement-breakpoint
CREATE INDEX "repo_note_repo_idx" ON "repo_note" USING btree ("repository_id","owner_id","created_at");