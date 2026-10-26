<script setup lang="ts">
import { ref } from "vue";

const count = ref<number>(0);
</script>

<template>
  <div class="glass-panel-box">
    <span class="common-badge-text">Vue 3 Island</span>
    <h3 class="vue-glow-text mt-2 text-2xl font-bold">Vue + Scoped CSS</h3>
    <p class="mt-1 text-slate-400">Reactive counter: {{ count }}</p>
    <button
      type="button"
      class="mt-4 rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-emerald-500"
      @click="count++"
    >
      Increment Vue State
    </button>
  </div>
</template>

<style scoped>
.vue-glow-text {
  letter-spacing: -0.02em;
}
</style>
