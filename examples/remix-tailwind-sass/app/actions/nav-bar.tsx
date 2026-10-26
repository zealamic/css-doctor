import type { Handle } from "remix/component";

export function NavBar(_handle: Handle) {
  return () => (
    <nav class="flex items-center justify-between border-b border-slate-800 px-8 py-4">
      <a class="text-xl font-bold text-blue-400" href="/">
        Remix 3 + CSS Doctor
      </a>
      <div class="flex gap-4 text-sm">
        <a class="text-slate-400 hover:text-white" href="/">
          Home
        </a>
        <a class="text-slate-400 hover:text-white" href="/dashboard">
          Dashboard
        </a>
        <a class="text-slate-400 hover:text-white" href="/settings">
          Settings
        </a>
      </div>
    </nav>
  );
}
