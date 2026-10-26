<script setup lang="ts"></script>

<template>
  <div class="mx-auto max-w-2xl py-10">
    <div class="panel-card p-8">
      <h2 class="mb-4 text-2xl font-bold text-white">Vue App Settings</h2>
      <div class="space-y-4">
        <div>
          <label
            class="block text-sm font-medium text-slate-300"
            for="environment-name"
          >
            Environment Name
          </label>
          <input
            id="environment-name"
            type="text"
            value="vite-vue-tailwind"
            class="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-white"
          />
        </div>
        <div class="danger-vue-divider pt-4">
          <button type="button" class="btn-emerald">Save Preferences</button>
        </div>
      </div>
    </div>
  </div>
</template>
