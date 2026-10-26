import { createSignal } from "solid-js";
import type { Component } from "solid-js";

export const IslandSolid: Component = () => {
  const [clicks, setClicks] = createSignal<number>(0);

  return (
    <div className="glass-panel-box">
      <span className="common-badge-text">SolidJS Island</span>
      <h3 className="mt-2 text-2xl font-bold text-blue-400">
        SolidJS Fine-Grained
      </h3>
      <p className="solid-metric-number mt-2 text-3xl">{clicks()} Clicks</p>
      <button
        type="button"
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-500"
        onClick={() => setClicks((value) => value + 1)}
      >
        Click Solid
      </button>
    </div>
  );
};
