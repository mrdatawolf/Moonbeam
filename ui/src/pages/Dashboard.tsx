import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "../api";

function StatusDot({ tone }: { tone: "success" | "warning" | "danger" | "muted" }) {
  const color = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    muted: "bg-muted-foreground",
  }[tone];
  return <span aria-hidden className={`inline-block size-2.5 rounded-full ${color}`} />;
}

export function Dashboard() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 10_000,
  });

  let tone: "success" | "warning" | "danger" | "muted" = "muted";
  let label = "Checking…";
  if (health.isError) {
    tone = "danger";
    label = "Server unreachable";
  } else if (health.data) {
    tone = health.data.status === "ok" ? "success" : "warning";
    label = health.data.status === "ok" ? "Server healthy" : "Server degraded";
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Moonbeam is running. Nothing to show yet.</p>

      <section
        aria-labelledby="health-heading"
        className="mt-8 rounded-card border border-border bg-card p-5"
      >
        <h2 id="health-heading" className="text-sm font-medium text-muted-foreground">
          System health
        </h2>
        <p className="mt-3 flex items-center gap-2 text-base font-medium" role="status">
          <StatusDot tone={tone} />
          {label}
        </p>
        {health.data && (
          <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Database</dt>
            <dd>
              {health.data.database.ok ? "Connected" : `Error: ${health.data.database.error ?? "unknown"}`}
            </dd>
            <dt className="text-muted-foreground">Checked</dt>
            <dd className="font-mono">{new Date(health.data.checkedAt).toLocaleTimeString()}</dd>
          </dl>
        )}
        {health.isError && (
          <p className="mt-3 text-sm text-muted-foreground">{health.error.message}</p>
        )}
      </section>
    </main>
  );
}
