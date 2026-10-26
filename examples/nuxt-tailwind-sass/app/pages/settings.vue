<template>
  <div class="max-w-2xl mx-auto">
    <div class="panel-container">
      <h2 class="text-2xl font-bold text-white mb-6">
        Application Preferences
      </h2>
      <div class="settings-input-group">
        <label class="block text-sm font-medium text-slate-300 mb-2"
          >Instance Identifier</label
        >
        <input
          type="text"
          value="nuxt-tailwind-sass"
          class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-[#00dc82]"
        />
      </div>
      <button
        type="button"
        class="px-4 py-2 bg-[#00dc82] text-slate-950 font-bold rounded-md"
      >
        Save Changes
      </button>
    </div>
  </div>
</template>
