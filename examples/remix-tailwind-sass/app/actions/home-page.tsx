import type { Handle } from "remix/component";

export function HomePage(_handle: Handle) {
  return () => (
    <main class="mx-auto max-w-4xl px-4 py-16 text-center">
      <h1 class="hero-gradient-title text-5xl font-extrabold tracking-tight">
        Remix 3 asset pipeline
      </h1>
      <p class="mt-4 text-lg text-slate-400">
        Tailwind, SCSS and CSS Modules optimized by css-doctor.
      </p>
      <a class="btn-primary-action mt-8 inline-block" href="/dashboard">
        Open Dashboard
      </a>
    </main>
  );
}
