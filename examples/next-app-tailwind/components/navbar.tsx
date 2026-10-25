import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
];

export function Navbar() {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4 text-slate-100">
      <Link className="font-semibold tracking-tight text-cyan-300" href="/">
        css-doctor
      </Link>
      <nav className="flex items-center gap-4 text-sm text-slate-300">
        {links.map((link) => (
          <Link
            className="nav-link rounded-full px-3 py-1 transition"
            href={link.href}
            key={link.href}
            prefetch={false}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
