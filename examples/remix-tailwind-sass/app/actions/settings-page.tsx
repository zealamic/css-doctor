import type { Handle } from "remix/component";

export function SettingsPage(_handle: Handle) {
  return () => (
    <main class="mx-auto max-w-2xl px-4 py-10">
      <h1 class="text-2xl font-bold text-white">Project Settings</h1>
      <section class="settings-form-wrapper mt-6">
        <label class="block text-sm font-medium text-slate-300" for="app-name">
          Application Name
        </label>
        <input
          class="settings-input-field mt-2"
          id="app-name"
          type="text"
          value="remix-tailwind-sass"
        />
        <button class="btn-primary-action mt-6" type="button">
          Save Settings
        </button>
      </section>
    </main>
  );
}
