import type { FC } from "react";
import { NavLink } from "react-router-dom";

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  isActive ? "font-semibold text-indigo-400" : "text-slate-400 hover:text-white";

export const NavBar: FC = () => {
  return (
    <nav className="flex items-center justify-between border-b border-slate-800 px-8 py-4">
      <div className="text-xl font-bold text-white">Rsbuild + CSS Doctor</div>
      <div className="flex gap-6">
        <NavLink className={navLinkClass} to="/">
          Home
        </NavLink>
        <NavLink className={navLinkClass} to="/dashboard">
          Dashboard
        </NavLink>
        <NavLink className={navLinkClass} to="/settings">
          Settings
        </NavLink>
      </div>
    </nav>
  );
};
