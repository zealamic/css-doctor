<script lang="ts">
  let count = $state<number>(0);
</script>

<div class="glass-panel-box">
  <span class="common-badge-text svelte-badge-indicator text-white"
    >Svelte 5 Island</span
  >
  <h3 class="mt-2 text-2xl font-bold text-orange-500">Svelte + Runes</h3>
  <p class="mt-1 text-slate-400">Svelte 5 state: {count}</p>
  <button
    type="button"
    class="mt-4 rounded-md bg-orange-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-orange-500"
    onclick={() => count++}
  >
    Increment Svelte State
  </button>
</div>

<style>
  h3 {
    text-transform: capitalize;
  }
</style>
