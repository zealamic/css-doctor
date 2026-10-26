import { useState } from "preact/hooks";
import type { FunctionalComponent } from "preact";
import styles from "../styles/module-preact.module.scss";

export const IslandPreact: FunctionalComponent = () => {
  const [likes, setLikes] = useState<number>(0);

  return (
    <div className={`glass-panel-box preact-accent-bar ${styles.box}`}>
      <span className="common-badge-text">Preact Island</span>
      <h3 className={`mt-2 text-2xl font-bold ${styles.tag}`}>
        Preact + SCSS Module
      </h3>
      <p className="mt-1 text-slate-400">Preact Lightweight Likes: {likes}</p>
      <button
        type="button"
        onClick={() => setLikes((value) => value + 1)}
        className="mt-4 rounded-md bg-violet-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-violet-500"
      >
        Like Preact
      </button>
    </div>
  );
};
