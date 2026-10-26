<script lang="ts">
  type Props = {
    currentRoute: string;
    onRouteChange: (route: string) => void;
  };

  let { currentRoute, onRouteChange }: Props = $props();

  const navClass = (route: string) =>
    currentRoute === route
      ? "font-semibold text-[#ff3e00]"
      : "text-slate-400 hover:text-white";
</script>

<nav
  class="flex items-center justify-between border-b border-slate-800 px-8 py-4"
>
  <div class="text-xl font-bold text-[#ff3e00]">
    Vite + Svelte 5 + CSS Doctor
  </div>
  <div class="flex gap-6">
    <button
      type="button"
      class={`text-sm transition-colors ${navClass("home")}`}
      onclick={() => onRouteChange("home")}
    >
      Home
    </button>
    <button
      type="button"
      class={`text-sm transition-colors ${navClass("dashboard")}`}
      onclick={() => onRouteChange("dashboard")}
    >
      Dashboard
    </button>
    <button
      type="button"
      class={`text-sm transition-colors ${navClass("settings")}`}
      onclick={() => onRouteChange("settings")}
    >
      Settings
    </button>
  </div>
</nav>
