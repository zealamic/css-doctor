import { HeroSurfaces } from "../components/hero-surfaces";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <HeroSurfaces />
      <section className="card-glassmorphism">
        <p className="text-sm uppercase tracking-widest text-cyan-300">
          Page coverage fixture
        </p>
        <h1 className="hero-title-gradient mt-4 max-w-3xl text-6xl font-bold tracking-tight">
          Build CSS that ships only what each route uses.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          Home owns the hero rules, while the shared shell stays in the common
          chunk.
        </p>
        <button className="btn-base-glow cta-pulse-button mt-8" type="button">
          Start optimizing
        </button>
      </section>

      <section className="card-glassmorphism">
        <h2 className="text-xl font-semibold text-slate-100">
          Shared glass card
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Used on both Home and Settings, so it belongs to the common chunk.
        </p>
      </section>
    </div>
  );
}
