<script setup lang="ts">
import NavBar from "~/components/nav-bar.vue";
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <NavBar />
    <main class="flex-1 max-w-5xl w-full mx-auto px-4 py-10">
      <slot />
    </main>
  </div>
</template>
