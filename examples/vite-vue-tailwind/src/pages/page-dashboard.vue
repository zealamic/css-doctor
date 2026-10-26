<script setup lang="ts">
import styles from "../styles/dashboard.module.css";

const cardClasses = ["panel-card", styles.card];
</script>

<template>
  <div class="mx-auto max-w-5xl py-10">
    <h2 class="mb-6 text-3xl font-bold text-white">Analytics Dashboard</h2>
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div :class="cardClasses">
        <div class="mb-2 flex items-center gap-2">
          <span :class="styles.statusDot"></span>
          <h3 class="font-semibold text-white">Live Node Metrics</h3>
        </div>
        <p class="metric-vue-badge mt-4 text-2xl font-bold text-emerald-400">
          99.98% Uptime
        </p>
      </div>
      <div :class="cardClasses">
        <h3 class="mb-2 font-semibold text-white">Bundle Health</h3>
        <p class="text-slate-300">
          Scoped styles safely bypassed by CSS Doctor.
        </p>
      </div>
    </div>
  </div>
</template>
