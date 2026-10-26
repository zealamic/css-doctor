<script setup lang="ts">
import styles from "~/assets/dashboard.module.scss";

const cardClasses = ["panel-container", styles.wrapper];
</script>

<template>
  <div>
    <h2 class="text-3xl font-bold text-white mb-6">Analytics Dashboard</h2>
    <div :class="cardClasses">
      <div class="flex items-center gap-2 mb-4">
        <span :class="styles.pulseCircle"></span>
        <h3 class="font-semibold text-white">Live Node Cluster</h3>
      </div>
      <p class="text-slate-300">
        SCSS Modules scoping is completely preserved by CSS Doctor.
      </p>
    </div>
  </div>
</template>

<style scoped>
h2 {
  letter-spacing: -0.015em;
}
</style>
