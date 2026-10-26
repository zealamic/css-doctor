<script lang="ts">
  import NavBar from "./components/nav-bar.svelte";

  type RouteKey = "home" | "dashboard" | "settings";

  let currentRoute = $state<RouteKey>("home");

  const handleRouteChange = (route: string) => {
    currentRoute = route as RouteKey;
  };
</script>

<div class="flex min-h-screen flex-col">
  <NavBar {currentRoute} onRouteChange={handleRouteChange} />
  <main class="flex-1 px-4">
    {#if currentRoute === "home"}
      {#await import("./pages/page-home.svelte") then { default: PageHome }}
        <PageHome />
      {/await}
    {:else if currentRoute === "dashboard"}
      {#await import("./pages/page-dashboard.svelte") then { default: PageDashboard }}
        <PageDashboard />
      {/await}
    {:else if currentRoute === "settings"}
      {#await import("./pages/page-settings.svelte") then { default: PageSettings }}
        <PageSettings />
      {/await}
    {/if}
  </main>
</div>
