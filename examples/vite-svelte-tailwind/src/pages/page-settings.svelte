<script lang="ts"></script>

<div class="mx-auto max-w-2xl py-10">
  <div class="panel-card p-8">
    <h2 class="mb-4 text-2xl font-bold text-white">Svelte App Settings</h2>
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-slate-300" for="env-name">
          Environment Name
        </label>
        <input
          id="env-name"
          type="text"
          value="vite-svelte-tailwind"
          class="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-white"
        />
      </div>
      <div class="danger-svelte-divider pt-4">
        <button type="button" class="btn-svelte">Save Preferences</button>
      </div>
    </div>
  </div>
</div>
