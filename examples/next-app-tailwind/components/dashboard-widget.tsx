import styles from "../styles/dashboard.module.css";

export function DashboardWidget() {
  return (
    <section className={styles.metricCard}>
      <div className="flex items-center justify-between">
        <p className="text-sm uppercase tracking-widest text-slate-400">
          Conversion
        </p>
        <span className={styles.badgeLive}>live</span>
      </div>
      <p className="mt-4 text-4xl font-semibold text-cyan-300">18.4%</p>
      <div className={styles.chartPlaceholder} />
    </section>
  );
}
