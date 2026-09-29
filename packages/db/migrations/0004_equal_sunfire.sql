CREATE TYPE "public"."flag_kind" AS ENUM('event', 'condition');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('open', 'dismissed', 'resolved', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."identity_kind" AS ENUM('email', 'login', 'alias');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('never_polled', 'ok', 'unreachable', 'rate_limited', 'token_rejected', 'token_missing', 'token_config_unreadable', 'not_found', 'identity_changed', 'branch_missing');--> statement-breakpoint
CREATE TABLE "commit_logins" (
	"project_id" uuid NOT NULL,
	"sha" text NOT NULL,
	"login" text,
	CONSTRAINT "commit_logins_project_id_sha_pk" PRIMARY KEY("project_id","sha")
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"rule" text NOT NULL,
	"kind" "flag_kind" NOT NULL,
	"subject_key" text NOT NULL,
	"subject" jsonb NOT NULL,
	"commit_sha" text,
	"task_id_text" text,
	"status" "flag_status" DEFAULT 'open' NOT NULL,
	"first_raised_at" timestamp with time zone NOT NULL,
	"status_changed_at" timestamp with time zone NOT NULL,
	"evidence" jsonb NOT NULL,
	CONSTRAINT "flags_rule_valid" CHECK ("flags"."rule" in ('FL-1', 'FL-2', 'FL-3', 'FL-4', 'FL-5', 'FL-6', 'FL-7', 'FL-8', 'FL-9', 'FL-10', 'FL-11'))
);
--> statement-breakpoint
CREATE TABLE "project_snapshots" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"head_sha" text NOT NULL,
	"polled_at" timestamp with time zone NOT NULL,
	"snapshot_version" integer NOT NULL,
	"snapshot" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_sources" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"status" "source_status" DEFAULT 'never_polled' NOT NULL,
	"status_since" timestamp with time zone NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_processed_head" text,
	"rate_limited_until" timestamp with time zone,
	"redirected_full_name" text,
	"token_write_scopes" boolean,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"baseline_needs_reset" boolean DEFAULT false NOT NULL,
	"repo_etag" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"github_owner" text NOT NULL,
	"github_repo" text NOT NULL,
	"github_repo_id" bigint NOT NULL,
	"tracked_branch" text DEFAULT 'main' NOT NULL,
	"token_label" text NOT NULL,
	"lead_developer_user_id" uuid,
	"baseline_sha" text NOT NULL,
	"baseline_committed_at" timestamp with time zone NOT NULL,
	"exempt_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stale_threshold_days" integer DEFAULT 14 NOT NULL,
	"registered_at" timestamp with time zone NOT NULL,
	"registered_by_user_id" uuid NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "projects_stale_threshold_positive" CHECK ("projects"."stale_threshold_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "identity_kind" NOT NULL,
	"value" text NOT NULL,
	"normalized" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by_user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_records" ADD COLUMN "flag_id" uuid;--> statement-breakpoint
ALTER TABLE "commit_logins" ADD CONSTRAINT "commit_logins_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sources" ADD CONSTRAINT "project_sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_lead_developer_user_id_users_id_fk" FOREIGN KEY ("lead_developer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_registered_by_user_id_users_id_fk" FOREIGN KEY ("registered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "flags_open_subject_uq" ON "flags" USING btree ("project_id","rule","subject_key") WHERE "flags"."status" = 'open';--> statement-breakpoint
CREATE INDEX "flags_project_status_idx" ON "flags" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_active_github_repo_id_uq" ON "projects" USING btree ("github_repo_id") WHERE "projects"."removed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_identities_user_kind_normalized_uq" ON "user_identities" USING btree ("user_id","kind","normalized");--> statement-breakpoint
CREATE INDEX "audit_flag_idx" ON "audit_records" USING btree ("flag_id","id");