import Card from "../components/card";

export default function Dashboard() {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <section className="chart-container rounded-lg bg-slate-900 p-4 font-mono text-white">
        <p className="metric-badge-pulsing">Live traffic</p>
        <strong className="text-3xl">1,284</strong>
        <span className="text-slate-400"> visitors today</span>
      </section>

      <Card title="Conversion">
        Dashboard-only metric card shared with Home.
      </Card>
    </main>
  );
}
