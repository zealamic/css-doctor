import type { FC } from "react";

const PageHome: FC = () => {
  return (
    <div className="mx-auto max-w-4xl py-16 text-center">
      <h1 className="hero-gradient-text text-5xl font-extrabold tracking-tight">
        Modern Rsbuild React Pipeline
      </h1>
      <p className="mt-4 text-lg text-slate-400">
        Testing Page-Coverage, Size-Budget and Minification using the LightningCSS engine.
      </p>
      <div className="mt-8">
        <button type="button" className="btn-primary-action">
          Explore Features
        </button>
      </div>
    </div>
  );
};

export default PageHome;
