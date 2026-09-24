import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` diffs the schema against the committed migration
// snapshots; it does not need a live database. `pnpm db:migrate` applies the
// generated SQL (see src/migrate.ts), starting embedded Postgres if needed.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
});
