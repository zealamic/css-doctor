import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CommonSurfaces } from "../components/common-surfaces";
import { Navbar } from "../components/navbar";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "css-doctor Next.js Tailwind fixture",
  description: "App Router page coverage and CSS Modules safety fixture",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 font-sans text-slate-100 antialiased">
        <CommonSurfaces />
        <Navbar />
        <main className="mx-auto max-w-6xl px-6 py-12">{children}</main>
      </body>
    </html>
  );
}
