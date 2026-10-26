import type { FC } from "react";
import { NavLink } from "react-router-dom";

type NavItem = {
  label: string;
  to: string;
  activeClass: string;
};

const navItems: NavItem[] = [
  {
    label: "Pure CSS (Home)",
    to: "/",
    activeClass:
      "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30",
  },
  {
    label: "Ant Design",
    to: "/antd",
    activeClass: "bg-blue-600/20 text-blue-400 border border-blue-500/30",
  },
  {
    label: "Material UI",
    to: "/mui",
    activeClass: "bg-purple-600/20 text-purple-400 border border-purple-500/30",
  },
  {
    label: "Chakra UI",
    to: "/chakra",
    activeClass: "bg-teal-600/20 text-teal-400 border border-teal-500/30",
  },
];

export const NavBar: FC = () => {
  return (
    <nav className="app-shell-header flex items-center justify-between px-8 py-4 sticky top-0 z-50">
      <div className="text-xl font-bold text-blue-400">
        Vite + 3rd UI + CSS Doctor
      </div>
      <div className="flex gap-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `nav-pill-item ${
                isActive ? item.activeClass : "text-slate-400 hover:text-white"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
