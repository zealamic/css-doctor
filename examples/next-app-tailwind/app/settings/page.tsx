import { SettingsForm } from "../../components/settings-form";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm uppercase tracking-widest text-cyan-300">
          Settings
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-100">
          Preferences
        </h1>
      </header>

      <section className="card-glassmorphism">
        <h2 className="text-lg font-semibold text-slate-100">
          Shared glass card
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Home and Settings share this rule, so it is common.
        </p>
        <button className="btn-base-glow mt-6" type="button">
          Refresh account
        </button>
      </section>

      <div className="danger-zone-divider" />

      <section>
        <h2 className="text-xl font-semibold text-red-300">Danger zone</h2>
        <p className="mt-2 text-sm text-slate-400">
          The divider is settings-only. The form below is a CSS Module.
        </p>
        <div className="mt-6">
          <SettingsForm />
        </div>
      </section>
    </div>
  );
}
