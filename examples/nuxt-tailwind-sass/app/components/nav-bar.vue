<script setup lang="ts">
type NavItem = {
  label: string;
  to: string;
};

const navLinks: NavItem[] = [
  { label: "Home", to: "/" },
  { label: "Dashboard", to: "/dashboard" },
  { label: "Settings", to: "/settings" },
];
</script>

<template>
  <nav
    class="app-header-shell flex items-center justify-between px-8 py-4 sticky top-0 z-50"
  >
    <div class="text-xl font-bold text-[#00dc82]">Nuxt 4 + CSS Doctor</div>
    <div class="flex gap-4">
      <NuxtLink
        v-for="link in navLinks"
        :key="link.to"
        :to="link.to"
        active-class="bg-[#00dc82]/20 text-[#00dc82]"
        class="nav-pill-btn text-slate-400 hover:text-white"
        no-prefetch
      >
        {{ link.label }}
      </NuxtLink>
    </div>
  </nav>
</template>
