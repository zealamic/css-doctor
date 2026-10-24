import Card from "../components/card";

export default function Home() {
  return (
    <main className="p-4">
      <h1 className="hero-gradient-text text-4xl font-bold">
        Build CSS that ships only what pages use
      </h1>
      <p className="text-emerald-500">
        This page owns the hero and call-to-action styles.
      </p>

      <div className="grid grid-cols-3 gap-4">
        <Card title="Analyze">Selectors and usage in one pass.</Card>
        <Card title="Split">Page-coverage chunks at build time.</Card>
        <Card title="Prune">Dead selectors never reach users.</Card>
      </div>

      <button
        className="btn-base cta-glow-effect mt-4 bg-emerald-600 p-4 text-white"
        type="button"
      >
        Start optimizing
      </button>
    </main>
  );
}
