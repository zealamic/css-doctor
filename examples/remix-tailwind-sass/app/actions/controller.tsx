import { createController } from "remix/router";
import type { RemixNode } from "remix/component";

import { assets } from "../assets.ts";
import { routes } from "../routes.ts";
import { DashboardPage } from "./dashboard-page.tsx";
import { Document } from "./document.tsx";
import { HomePage } from "./home-page.tsx";
import { NavBar } from "./nav-bar.tsx";
import { SettingsPage } from "./settings-page.tsx";

type RenderContext = {
  render: (node: RemixNode, init?: ResponseInit) => Response;
};

const dashboardStylesheets = ["/assets/app/styles/dashboard.module.scss"];
const settingsStylesheets = ["/assets/app/styles/settings.module.css"];

export default createController(routes, {
  actions: {
    home(context) {
      return (context as typeof context & RenderContext).render(
        <Document title="Home | Remix 3">
          <NavBar />
          <HomePage />
        </Document>,
      );
    },
    dashboard(context) {
      return (context as typeof context & RenderContext).render(
        <Document
          title="Dashboard | Remix 3"
          stylesheets={dashboardStylesheets}
        >
          <NavBar />
          <DashboardPage />
        </Document>,
      );
    },
    settings(context) {
      return (context as typeof context & RenderContext).render(
        <Document title="Settings | Remix 3" stylesheets={settingsStylesheets}>
          <NavBar />
          <SettingsPage />
        </Document>,
      );
    },
    assets(context) {
      return assets.fetch(context.request).then((response) => {
        return response ?? new Response("Asset not found", { status: 404 });
      });
    },
  },
});
