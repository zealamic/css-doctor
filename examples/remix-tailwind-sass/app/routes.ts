import { get, route } from "remix/routes";

export const routes = route({
  home: get("/"),
  dashboard: get("/dashboard"),
  settings: get("/settings"),
  assets: get("/assets/*path"),
});
