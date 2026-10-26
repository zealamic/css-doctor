import { lazy, Suspense } from "react";
import type { FC } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { LoadingSpinner } from "./components/loading-spinner";
import { NavBar } from "./components/nav-bar";
import "./styles/app.css";
import "./styles/styles-custom.css";

const PageHome = lazy(() => import("./pages/page-home"));
const PageAntd = lazy(() => import("./pages/page-antd"));
const PageMui = lazy(() => import("./pages/page-mui"));
const PageChakra = lazy(() => import("./pages/page-chakra"));

export const App: FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route element={<PageHome />} path="/" />
              <Route element={<PageAntd />} path="/antd" />
              <Route element={<PageMui />} path="/mui" />
              <Route element={<PageChakra />} path="/chakra" />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
