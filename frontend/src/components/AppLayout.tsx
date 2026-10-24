import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type NavItem = { label: string; to: string };

function itemsForRole(role: "ADMIN" | "HR" | "EMPLOYEE"): NavItem[] {
  const common: NavItem[] = [{ label: "Dashboard", to: "/" }];
  if (role === "ADMIN") {
    return [
      ...common,
      { label: "Organization", to: "/organization" },
      { label: "Users", to: "/users" },
      { label: "Employees", to: "/employees" },
      { label: "Attendance", to: "/attendance" },
      { label: "Leave", to: "/leave" },
      { label: "Payroll", to: "/payroll" },
      { label: "Communications", to: "/communications" },
      { label: "Audit log", to: "/audit" },
      { label: "AI assistant", to: "/assistant" },
    ];
  }
  if (role === "HR") {
    return [
      ...common,
      { label: "Organization", to: "/organization" },
      { label: "Employees", to: "/employees" },
      { label: "Attendance", to: "/attendance" },
      { label: "Corrections", to: "/attendance/corrections" },
      { label: "Leave", to: "/leave" },
      { label: "Payroll", to: "/payroll" },
      { label: "Communications", to: "/communications" },
      { label: "AI assistant", to: "/assistant" },
    ];
  }
  return [
    ...common,
    { label: "My profile", to: "/profile" },
    { label: "Attendance", to: "/attendance" },
    { label: "Register my face", to: "/face/register" },
    { label: "Camera check-in", to: "/face/check-in" },
    { label: "Leave", to: "/leave" },
    { label: "Payslips", to: "/payroll" },
    { label: "AI assistant", to: "/assistant" },
  ];
}

export function AppLayout() {
  const { session, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!session) return null;
  const items = itemsForRole(session.user.role);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              className="button button-secondary !px-3 lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
            <NavLink to="/" className="flex min-w-0 items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-800 text-sm font-bold text-white">H</span>
              <span className="truncate text-sm font-bold text-slate-950 sm:text-base">HCM Lite</span>
            </NavLink>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-48 truncate text-right text-xs text-slate-500 sm:block">{session.user.email}</span>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-900">{session.user.role}</span>
            <button type="button" className="button button-ghost !px-2.5" onClick={signOut}>Log out</button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-screen-2xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6 lg:flex lg:px-8" aria-label="Main navigation">
          {items.map((item) => (
            <NavLink
              end={item.to === "/"}
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        {menuOpen ? (
          <nav className="grid gap-1 border-t border-slate-100 px-4 py-3 lg:hidden" aria-label="Mobile navigation">
            {items.map((item) => (
              <NavLink
                end={item.to === "/"}
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
