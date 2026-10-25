import { DashboardWidget } from "../../components/dashboard-widget";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="global-stat-indicator">Dashboard only</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-100">
            Live metrics
          </h1>
        </div>
        <p className="max-w-sm text-sm text-slate-400">
          The stat indicator is page-specific; the metric card is a scoped CSS
          Module that css-doctor must leave untouched.
        </p>
      </header>

      <div className="grid gap-6 grid-cols-2">
        <DashboardWidget />
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-slate-100">
            Route payload
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            This page also uses shared glass card utilities.
          </p>
        </section>
      </div>
    </div>
  );
}
