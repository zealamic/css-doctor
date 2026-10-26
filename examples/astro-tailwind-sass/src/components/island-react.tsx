import { useState } from "react";
import type { FC } from "react";
import styles from "../styles/module-react.module.scss";

export const IslandReact: FC = () => {
  const [count, setCount] = useState<number>(0);

  return (
    <div className={`glass-panel-box react-spin-border ${styles.container}`}>
      <span className="common-badge-text">React 19 Island</span>
      <h3 className={styles.title}>React + SCSS Module</h3>
      <p className="mt-2 text-slate-400">Active state count: {count}</p>
      <button
        type="button"
        onClick={() => setCount((value) => value + 1)}
        className="mt-4 rounded-md bg-cyan-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-cyan-500"
      >
        Increment React State
      </button>
    </div>
  );
};
