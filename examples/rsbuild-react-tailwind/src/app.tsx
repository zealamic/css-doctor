import type { FC } from "react";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LoadingSpinner } from "./components/loading-spinner";
import { NavBar } from "./components/nav-bar";
import "./app.css";

const PageHome = lazy(() => import("./pages/page-home"));
const PageDashboard = lazy(() => import("./pages/page-dashboard"));
const PageSettings = lazy(() => import("./pages/page-settings"));

export const App: FC = () => {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col">
        <NavBar />
        <main className="flex-1 px-4">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route element={<PageHome />} path="/" />
              <Route element={<PageDashboard />} path="/dashboard" />
              <Route element={<PageSettings />} path="/settings" />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
