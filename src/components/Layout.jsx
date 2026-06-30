import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
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
} from 'lucide-react';
import { isDemoMode, liveMutationsEnabled } from '../api';

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/products', label: 'Products', icon: PackageOpen },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/broadcasts', label: 'Updates', icon: MessageSquareText },
  { to: '/reminders', label: 'Reminders', icon: BellRing },
];

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function Layout() {
  const [open, setOpen] = useState(false);
  const navigationRef = useRef(null);
  const closeButtonRef = useRef(null);
  const menuButtonRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    const content = contentRef.current;
    if (content) content.inert = true;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = [...(navigationRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) ?? [])]
        .filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (content) content.inert = false;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      else menuButtonRef.current?.focus();
    };
  }, [open]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside
        id="primary-navigation"
        ref={navigationRef}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? 'true' : undefined}
        aria-label="Primary navigation"
        className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-72 bg-emerald-950 text-white transition-transform lg:static lg:w-auto lg:translate-x-0`}
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
              ref={closeButtonRef}
              type="button"
              className="rounded-lg p-2 text-emerald-100 hover:bg-white/10 lg:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              <X aria-hidden="true" size={22} />
            </button>
          </div>

          <nav className="flex-1 space-y-1 p-4" aria-label="Primary navigation links">
            {navigation.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${
                    isActive
                      ? 'bg-amber-400 text-emerald-950'
                      : 'text-emerald-50 hover:bg-white/10'
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
          tabIndex={-1}
        />
      )}

      <div ref={contentRef} className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-stone-200 bg-[#f4f1e8]/95 px-4 backdrop-blur md:px-7">
          <button
            ref={menuButtonRef}
            type="button"
            className="rounded-xl border border-stone-300 bg-white p-2.5 text-stone-800 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-controls="primary-navigation"
            aria-expanded={open}
          >
            <Menu aria-hidden="true" size={22} />
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
            Preview mode is active. Connect a protected backend before using live data.
          </div>
        )}

        {!isDemoMode && !liveMutationsEnabled && (
          <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm text-sky-950 md:px-7">
            Live data is connected in read-only mode. Changes remain locked until production safeguards are verified.
          </div>
        )}

        <main className="mx-auto max-w-7xl p-4 md:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
