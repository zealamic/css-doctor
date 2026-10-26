export default function Settings() {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="danger-zone-border rounded-lg p-4">
        <label className="toggle-switch-slider">
          <input className="accent-rose-500" type="checkbox" />
          Enable experimental features
        </label>

        <button
          className="btn-base mt-4 cursor-not-allowed bg-rose-600 p-4 text-white"
          type="button"
          disabled
        >
          Delete workspace
        </button>
      </section>
    </main>
  );
}
