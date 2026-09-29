import { useState } from "react";
import { useFirstRunSetup } from "../api/queries";
import { Field, Refusal } from "../components/common";

interface Row {
  key: number;
  displayName: string;
  email: string;
}

let nextKey = 1;
const emptyRow = (): Row => ({ key: nextKey++, displayName: "", email: "" });

export function SetupPage() {
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const setup = useFirstRunSetup();
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.displayName.trim() || r.email.trim());

  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Set up Moonbeam</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the people on your board with their display names and e-mail addresses. You can add more people later.
      </p>
      <form
        className="mt-6 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          setup.mutate({
            users: filled.map((r) => ({ displayName: r.displayName.trim(), email: r.email.trim() })),
          });
        }}
      >
        <fieldset className="card space-y-4 p-4">
          <legend className="px-1 text-base font-semibold">Board members</legend>
          {rows.map((r, i) => (
            <div key={r.key} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label={`Name ${i + 1}`} required value={r.displayName} onChange={(v) => update(r.key, { displayName: v })} autoFocus={i === 0} />
              <Field label={`E-mail ${i + 1}`} type="email" required value={r.email} onChange={(v) => update(r.key, { email: v })} />
              <button
                type="button"
                className="btn-secondary"
                aria-disabled={rows.length === 1}
                aria-label={`Remove person ${i + 1}`}
                onClick={() => rows.length > 1 && setRows((rs) => rs.filter((x) => x.key !== r.key))}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn-secondary" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
            Add another person
          </button>
        </fieldset>

        <Refusal error={setup.error} />
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" aria-disabled={setup.isPending || filled.length === 0}>
            {setup.isPending ? "Setting up…" : "Finish setup"}
          </button>
        </div>
      </form>
    </main>
  );
}
