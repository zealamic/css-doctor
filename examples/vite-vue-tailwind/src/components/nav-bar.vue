<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <nav
    class="flex items-center justify-between border-b border-slate-800 px-8 py-4"
  >
    <div class="text-xl font-bold text-emerald-400">
      Vite + Vue 3 + CSS Doctor
    </div>
    <div class="flex gap-6">
      <RouterLink
        active-class="font-semibold text-emerald-400"
        class="text-slate-400 transition-colors hover:text-white"
        to="/"
      >
        Home
      </RouterLink>
      <RouterLink
        active-class="font-semibold text-emerald-400"
        class="text-slate-400 transition-colors hover:text-white"
        to="/dashboard"
      >
        Dashboard
      </RouterLink>
      <RouterLink
        active-class="font-semibold text-emerald-400"
        class="text-slate-400 transition-colors hover:text-white"
        to="/settings"
      >
        Settings
      </RouterLink>
    </div>
  </nav>
</template>
