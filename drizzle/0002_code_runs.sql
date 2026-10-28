CREATE TABLE "code_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"language" text NOT NULL,
	"code" text NOT NULL,
	"stdin" text DEFAULT '' NOT NULL,
	"phase" text NOT NULL,
	"compile_output" text DEFAULT '' NOT NULL,
	"stdout" text DEFAULT '' NOT NULL,
	"stderr" text DEFAULT '' NOT NULL,
	"exit_code" integer,
	"timed_out" boolean DEFAULT false NOT NULL,
	"truncated" boolean DEFAULT false NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "code_run" ADD CONSTRAINT "code_run_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "code_run_owner_idx" ON "code_run" USING btree ("owner_id","created_at");