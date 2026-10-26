<script lang="ts">
  import styles from "../styles/dashboard.module.css";
</script>

<div class="mx-auto max-w-5xl py-10">
  <h2 class="mb-6 text-3xl font-bold text-white">Analytics Dashboard</h2>
  <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
    <div class="panel-card {styles.card}">
      <div class="mb-2 flex items-center gap-2">
        <span class={styles.statusDot}></span>
        <h3 class="font-semibold text-white">Live Node Metrics</h3>
      </div>
      <p class="metric-svelte-badge mt-4 text-2xl font-bold text-[#ff3e00]">
        99.98% Uptime
      </p>
    </div>
    <div class="panel-card {styles.card}">
      <h3 class="mb-2 font-semibold text-white">Bundle Health</h3>
      <p class="text-slate-300">Scoped styles safely bypassed by CSS Doctor.</p>
    </div>
  </div>
</div>

<style>
  h2 {
    letter-spacing: -0.01em;
  }
</style>
