import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: () => import("../pages/page-home.vue"),
  },
  {
    path: "/dashboard",
    name: "dashboard",
    component: () => import("../pages/page-dashboard.vue"),
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("../pages/page-settings.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
