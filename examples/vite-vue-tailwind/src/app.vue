<script setup lang="ts">
import { RouterView } from "vue-router";
import NavBar from "./components/nav-bar.vue";
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <NavBar />
    <main class="flex-1 px-4">
      <RouterView />
    </main>
  </div>
</template>
