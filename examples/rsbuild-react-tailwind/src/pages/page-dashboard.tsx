import type { FC } from "react";
import styles from "../styles/dashboard.module.css";

const PageDashboard: FC = () => {
  return (
    <div className="mx-auto max-w-5xl py-10">
      <h2 className="mb-6 text-3xl font-bold text-white">Analytics Dashboard</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className={`panel-glass ${styles.card}`}>
          <div className="mb-2 flex items-center gap-2">
            <span className={styles.statusIndicator} />
            <h3 className="font-semibold text-white">Live Requests</h3>
          </div>
          <p className="metric-badge-live mt-4 pl-3 text-2xl font-bold text-cyan-400">
            1,248 req/s
          </p>
        </div>
        <div className={`panel-glass ${styles.card}`}>
          <h3 className="mb-2 font-semibold text-white">CSS Optimization</h3>
          <p className="text-slate-300">Variables isolated &amp; chunk split active.</p>
        </div>
      </div>
    </div>
  );
};

export default PageDashboard;
