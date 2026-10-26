import type { Handle } from "remix/component";

export function DashboardPage(_handle: Handle) {
  return () => (
    <main class="mx-auto max-w-5xl px-4 py-10">
      <h1 class="text-3xl font-bold text-white">Analytics Dashboard</h1>
      <div class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <section class="panel-card-glass dashboard-module-card">
          <h2 class="text-xl font-semibold text-white">Live Node Metrics</h2>
          <p class="mt-3 flex items-center gap-2 text-slate-300">
            <span class="dashboard-module-live-dot" />
            99.98% Uptime
          </p>
        </section>
        <section class="panel-card-glass dashboard-module-card">
          <h2 class="text-xl font-semibold text-white">CSS Optimization</h2>
          <p class="mt-3 text-slate-300">
            SCSS Module paths are preserved safely.
          </p>
        </section>
      </div>
    </main>
  );
}
