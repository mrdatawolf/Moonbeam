CREATE TYPE "public"."actor_kind" AS ENUM('human', 'agent', 'system', 'setup');--> statement-breakpoint
CREATE TYPE "public"."blocker_kind" AS ENUM('manual', 'integration');--> statement-breakpoint
CREATE TYPE "public"."blocker_resolution" AS ENUM('resolved', 'moot');--> statement-breakpoint
CREATE TYPE "public"."claimant_kind" AS ENUM('human', 'agent');--> statement-breakpoint
CREATE TYPE "public"."pause_close_reason" AS ENUM('answered', 'superseded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."review_entry" AS ENUM('handoff', 'subtasks');--> statement-breakpoint
CREATE TYPE "public"."review_verdict" AS ENUM('pass', 'changes_required', 'human_decision_required');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('active', 'finished', 'failed', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."task_state" AS ENUM('proposed', 'approved', 'in_progress', 'in_review', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"role" text NOT NULL,
	"model" text NOT NULL,
	"quantization" text,
	"status" "run_status" DEFAULT 'active' NOT NULL,
	"started_by_user_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_records" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"task_id" uuid,
	"parent_task_id" uuid,
	"subject_user_id" uuid,
	"action" text NOT NULL,
	"from_state" text,
	"to_state" text,
	"rejected" boolean DEFAULT false NOT NULL,
	"actor_kind" "actor_kind" NOT NULL,
	"actor_user_id" uuid,
	"identity_mode" text,
	"actor_run_id" uuid,
	"actor_role" text,
	"actor_model" text,
	"system_trigger" text,
	"reason" text,
	"details" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blockers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"kind" "blocker_kind" NOT NULL,
	"what_is_needed" text NOT NULL,
	"who_can_resolve" text NOT NULL,
	"effect" text NOT NULL,
	"details" jsonb,
	"added_by_kind" "actor_kind" NOT NULL,
	"added_by_user_id" uuid,
	"added_by_run_id" uuid,
	"added_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_kind" "actor_kind",
	"resolved_by_user_id" uuid,
	"resolved_by_run_id" uuid,
	"resolution" "blocker_resolution"
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"claimant_kind" "claimant_kind" NOT NULL,
	"user_id" uuid,
	"run_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"lease_suspended_remaining_ms" integer,
	"last_renewed_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"end_reason" text
);
--> statement-breakpoint
CREATE TABLE "handoffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"claimant_kind" "claimant_kind" NOT NULL,
	"user_id" uuid,
	"run_id" uuid,
	"model" text,
	"record" jsonb NOT NULL,
	"commit" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"question" text NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"close_reason" "pause_close_reason"
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"repo_path" text NOT NULL,
	"main_branch" text DEFAULT 'main' NOT NULL,
	"registered_at" timestamp with time zone NOT NULL,
	"registered_by_user_id" uuid,
	CONSTRAINT "projects_repo_path_unique" UNIQUE("repo_path")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"handoff_id" uuid,
	"reviewer_run_id" uuid NOT NULL,
	"reviewer_model" text NOT NULL,
	"verdict" "review_verdict" NOT NULL,
	"findings" jsonb NOT NULL,
	"same_model" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "run_credentials_run_id_unique" UNIQUE("run_id"),
	CONSTRAINT "run_credentials_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"projects_root" text,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"parent_id" uuid,
	"title" text NOT NULL,
	"desired_outcome" text NOT NULL,
	"acceptance_criteria" jsonb NOT NULL,
	"envelope" jsonb NOT NULL,
	"state" "task_state" NOT NULL,
	"author_kind" "claimant_kind" NOT NULL,
	"author_user_id" uuid,
	"author_run_id" uuid,
	"origin_task_id" uuid,
	"queue_position" integer,
	"sibling_position" integer,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"entered_review_by" "review_entry",
	"latest_handoff_id" uuid,
	"return_notes" text,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" uuid,
	"accepted_commit" text,
	"review_waiver_reason" text,
	"work_on_main" boolean DEFAULT false NOT NULL,
	"fell_back_at" timestamp with time zone,
	"ever_claimed" boolean DEFAULT false NOT NULL,
	"pending_completion_review_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_started_by_user_id_users_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_added_by_run_id_agent_runs_id_fk" FOREIGN KEY ("added_by_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_resolved_by_run_id_agent_runs_id_fk" FOREIGN KEY ("resolved_by_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pauses" ADD CONSTRAINT "pauses_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pauses" ADD CONSTRAINT "pauses_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_registered_by_user_id_users_id_fk" FOREIGN KEY ("registered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_handoff_id_handoffs_id_fk" FOREIGN KEY ("handoff_id") REFERENCES "public"."handoffs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_run_id_agent_runs_id_fk" FOREIGN KEY ("reviewer_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_credentials" ADD CONSTRAINT "run_credentials_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_tasks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_author_run_id_agent_runs_id_fk" FOREIGN KEY ("author_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_origin_task_id_tasks_id_fk" FOREIGN KEY ("origin_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_task_idx" ON "agent_runs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "audit_task_idx" ON "audit_records" USING btree ("task_id","id");--> statement-breakpoint
CREATE INDEX "audit_project_idx" ON "audit_records" USING btree ("project_id","id");--> statement-breakpoint
CREATE INDEX "audit_rejected_idx" ON "audit_records" USING btree ("rejected","id");--> statement-breakpoint
CREATE INDEX "blockers_task_idx" ON "blockers" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_one_active_per_task_uq" ON "claims" USING btree ("task_id") WHERE "claims"."ended_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "claims_one_active_per_run_uq" ON "claims" USING btree ("run_id") WHERE "claims"."ended_at" is null and "claims"."run_id" is not null;--> statement-breakpoint
CREATE INDEX "pauses_task_idx" ON "pauses" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_project_number_uq" ON "tasks" USING btree ("project_id","number");--> statement-breakpoint
CREATE INDEX "tasks_project_state_idx" ON "tasks" USING btree ("project_id","state");--> statement-breakpoint
CREATE INDEX "tasks_parent_idx" ON "tasks" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_active_display_name_uq" ON "users" USING btree (lower("display_name")) WHERE "users"."active";