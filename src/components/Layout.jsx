import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BellRing,
  ClipboardList,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  PackageOpen,
  Sprout,
  Users,
  X,
} from "lucide-react";
import { isDemoMode } from "../api";

const navigation = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/products", label: "Products", icon: PackageOpen },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/broadcasts", label: "Updates", icon: MessageSquareText },
  { to: "/reminders", label: "Reminders", icon: BellRing },
];

export default function Layout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside
        className={`${open ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 w-68 bg-emerald-950 text-white transition-transform lg:static lg:w-auto lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-amber-400 text-emerald-950">
                <Sprout aria-hidden="true" size={24} />
              </div>
              <div>
                <p className="font-bold leading-tight">Small Town Veggies</p>
                <p className="text-xs text-emerald-200">Ovett, Mississippi</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-emerald-100 hover:bg-white/10 lg:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              <X size={22} />
            </button>
          </div>

          <nav className="flex-1 space-y-1 p-4" aria-label="Primary navigation">
            {navigation.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${
                    isActive
                      ? "bg-amber-400 text-emerald-950"
                      : "text-emerald-50 hover:bg-white/10"
                  }`
                }
              >
                <Icon aria-hidden="true" size={20} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/10 p-4 text-xs text-emerald-200">
            Orders, customers, and pickup communication in one place.
          </div>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-stone-200 bg-[#f4f1e8]/95 px-4 backdrop-blur md:px-7">
          <button
            type="button"
            className="rounded-xl border border-stone-300 bg-white p-2.5 text-stone-800 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Produce stand operations
            </p>
          </div>
          {isDemoMode && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
              Demo data
            </span>
          )}
        </header>

        {isDemoMode && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 md:px-7">
            Preview mode is active. Connect a backend with <code>VITE_API_URL</code> before using live actions.
          </div>
        )}

        <main className="mx-auto max-w-7xl p-4 md:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
