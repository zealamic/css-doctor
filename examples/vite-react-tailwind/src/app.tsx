import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import Navbar from "./components/navbar";

const Home = lazy(() => import("./pages/home"));
const Dashboard = lazy(() => import("./pages/dashboard"));
const Settings = lazy(() => import("./pages/settings"));

const pageStyles: Record<string, string> = {
  "/": "page-home.css",
  "/dashboard": "page-dashboard.css",
  "/settings": "page-settings.css",
};

function PageStyles() {
  const { pathname } = useLocation();

  useEffect(() => {
    for (const link of document.querySelectorAll<HTMLLinkElement>(
      "link[data-cssd-page]",
    )) {
      link.remove();
    }

    if (!import.meta.env.PROD) {
      return;
    }

    const normalized = pathname.replace(/\/+$/, "") || "/";
    const fileName = pageStyles[normalized];

    if (!fileName) {
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${import.meta.env.BASE_URL}${fileName}`;
    link.dataset.cssdPage = "true";
    document.head.append(link);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <PageStyles />
      <div className="app-shell">
        <Navbar />
        <Suspense fallback={<div className="p-4">Loading page…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}
