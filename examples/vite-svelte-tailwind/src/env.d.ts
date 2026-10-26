/// <reference types="vite/client" />
/// <reference types="svelte" />

declare module "*.module.css" {
  const classes: Record<string, string>;

  export default classes;
}
