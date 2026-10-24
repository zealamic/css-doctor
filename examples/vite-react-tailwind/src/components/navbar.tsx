import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <header className="flex items-center justify-between rounded-lg bg-slate-800 p-4 text-white">
      <span className="nav-link font-semibold">css-doctor</span>
      <nav className="flex items-center gap-4" aria-label="Main navigation">
        <NavLink className="nav-link" to="/">
          Home
        </NavLink>
        <NavLink className="nav-link" to="/dashboard">
          Dashboard
        </NavLink>
        <NavLink className="nav-link" to="/settings">
          Settings
        </NavLink>
      </nav>
    </header>
  );
}
