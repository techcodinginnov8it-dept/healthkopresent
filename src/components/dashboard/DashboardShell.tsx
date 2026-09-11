"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { DashboardRole, ModuleId } from "@/lib/dashboard/types";

export type DashboardNavItem<TModule extends ModuleId> = {
  id: TModule;
  label: string;
  badge?: number;
};

function NavIcon({ id }: { id: ModuleId }) {
  const iconClass = "h-[1.1rem] w-[1.1rem]";

  switch (id) {
    case "overview":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 13h8V3H3v10Z" />
          <path d="M13 21h8V11h-8v10Z" />
          <path d="M13 3v6h8V3h-8Z" />
          <path d="M3 21h8v-6H3v6Z" />
        </svg>
      );
    case "schedule":
    case "book":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <path d="M3 10h18" />
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <path d="m9 16 2 2 4-5" />
        </svg>
      );
    case "live":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 10.5 21 7v10l-6-3.5" />
          <rect x="3" y="6" width="12" height="12" rx="3" />
        </svg>
      );
    case "patients":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "history":
    case "prescriptions":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M12 18v-6" />
          <path d="M9 15h6" />
        </svg>
      );
    case "certificates":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "research":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M6 6h10" />
          <path d="M6 10h10" />
          <path d="M6 14h6" />
        </svg>
      );
    case "settings":
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2l-.13.72a2 2 0 0 1-2.83 1.17l-.64-.36a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.61.43a2 2 0 0 1 0 3.4l-.61.43a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.64-.36a2 2 0 0 1 2.83 1.17l.13.72a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2l.13-.72a2 2 0 0 1 2.83-1.17l.64.36a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.61-.43a2 2 0 0 1 0-3.4l.61-.43a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.64.36a2 2 0 0 1-2.83-1.17L14.22 4a2 2 0 0 0-2-2Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
  }
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      {collapsed ? <path d="m9 18 6-6-6-6" /> : <path d="m15 18-6-6 6-6" />}
    </svg>
  );
}

function AvatarInitials({ name, dark }: { name: string; dark?: boolean }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black ${
        dark ? "bg-brand-teal/20 text-brand-teal" : "bg-brand-teal/15 text-brand-teal"
      }`}
    >
      {initials}
    </div>
  );
}

export function DashboardShell<TModule extends ModuleId>({
  role,
  theme = "light",
  onToggleTheme,
  activeModule,
  navItems,
  title,
  subtitle,
  profile,
  statusIndicator,
  connectionState,
  notificationBell,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  onLogout,
  children,
}: {
  role: DashboardRole;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
  activeModule: TModule;
  navItems: DashboardNavItem<TModule>[];
  title: string;
  subtitle: string;
  profile: {
    name: string;
    detail: string;
    meta?: string;
    image?: string | null;
    isVerified?: boolean;
  };
  statusIndicator?: ReactNode;
  connectionState: "connected" | "reconnecting" | "offline";
  notificationBell?: ReactNode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: (module: TModule) => void;
  onLogout: () => ReactNode;
  children: ReactNode;
}) {
  const isDoctor = role === "doctor";
  const shellTheme = theme ?? "light";
  const isDark = shellTheme === "dark";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const shellBg = isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50/70 text-slate-900";
  const sidebarBg = isDark ? "bg-slate-950 border-slate-800/80" : "bg-white border-slate-200";
  const muted = isDark ? "text-slate-400" : "text-slate-500";
  const sidebarWidth = collapsed ? "md:w-24 lg:w-24" : "md:w-80 lg:w-80";
  const navIdle = isDark
    ? "text-slate-400 hover:bg-slate-800/80 hover:text-white"
    : "text-slate-500 hover:bg-slate-100 hover:text-slate-950";

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  const headerBg = isDark
    ? "border-slate-800/80 bg-slate-950/95"
    : "border-slate-200/80 bg-white/95";

  return (
    <div className={`min-h-screen ${shellBg} font-sans lg:flex`}>
      {/* Mobile backdrop overlay */}
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close mobile navigation"
          className="fixed inset-0 z-55 bg-slate-950/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-60 flex w-[min(88vw,22rem)] -translate-x-full flex-col justify-between overflow-y-auto border-r transition-all duration-300 ease-in-out md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 md:overflow-hidden ${sidebarWidth} ${mobileNavOpen ? "translate-x-0 shadow-2xl" : ""} ${sidebarBg}`}
        aria-label={`${role} dashboard navigation`}
      >
        <div className="flex flex-col gap-6 p-5">
          {/* Sidebar header */}
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : "justify-between"}`}>
            <button
              type="button"
              onClick={() => {
                onNavigate("overview" as TModule);
                setMobileNavOpen(false);
              }}
              className={`group flex select-none items-center gap-2.5 text-left transition-opacity hover:opacity-95 ${collapsed ? "justify-center" : ""}`}
              aria-label="Go to dashboard overview"
            >
              {/* Responsive Logo Emblem */}
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-all ${
                  isDark
                    ? "border-slate-700/80 bg-slate-900 shadow-xs shadow-teal-950/40 group-hover:border-slate-600"
                    : "border-slate-200/80 bg-white shadow-xs shadow-slate-200/50 group-hover:border-slate-300"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4v16m-8-8h16" stroke="#E02424" />
                  <circle cx="12" cy="12" r="3" stroke="#0E9F6E" strokeWidth="2.2" fill={isDark ? "#0f172a" : "#ffffff"} />
                </svg>
              </div>
              {!collapsed && (
                <span className="font-display text-xl tracking-tight leading-none">
                  <span className="font-black text-brand-red">H</span>
                  <span className={`font-extrabold transition-colors duration-200 ${isDark ? "text-white" : "text-slate-900"}`}>ealth</span>
                  <span className="font-black text-brand-teal">K</span>
                  <span className={`font-extrabold transition-colors duration-200 ${isDark ? "text-white" : "text-slate-900"}`}>o</span>
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleCollapsed}
                className={`hidden h-8 w-8 items-center justify-center rounded-lg border md:flex transition-colors ${
                  isDark
                    ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <CollapseIcon collapsed={collapsed} />
              </button>
              {/* Mobile close button */}
              <button
                type="button"
                className={`grid h-8 w-8 place-items-center rounded-lg border md:hidden transition-colors ${
                  isDark
                    ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation drawer"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18" strokeLinecap="round" />
                  <path d="m6 6 12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Profile card in sidebar (mobile only) */}
          {!collapsed && (
            <div className={`flex items-center gap-3 rounded-2xl border p-3 md:hidden transition-colors ${
              isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50/70"
            }`}>
              {profile.image ? (
                <div className="h-10 w-10 shrink-0 rounded-xl bg-cover bg-center ring-2 ring-brand-teal/20" style={{ backgroundImage: `url(${profile.image})` }} role="img" aria-label={`${profile.name} profile image`} />
              ) : (
                <AvatarInitials name={profile.name} dark={isDark} />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="truncate text-sm font-black">{profile.name}</p>
                  {profile.isVerified && (
                    <span
                      title="Verified Doctor Account"
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-brand-teal"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7z" />
                        <path d="m9 12 2 2 4-4" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </div>
                <p className={`truncate text-xs font-medium ${muted}`}>{profile.detail}</p>
              </div>
            </div>
          )}

          {/* Nav items */}
          <nav className="space-y-0.5" aria-label="Dashboard navigation">
            {navItems.map((item) => {
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`flex min-h-[2.75rem] w-full items-center rounded-xl py-2.5 text-left text-sm font-bold transition-all duration-200 ${
                    isActive
                      ? "bg-brand-teal text-white shadow-sm shadow-brand-teal/30"
                      : navIdle
                  } ${collapsed ? "justify-center px-2" : "gap-3 px-3"}`}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-white/20" : "bg-current/[0.08]"}`}>
                    <NavIcon id={item.id} />
                  </span>
                  {!collapsed && (
                    <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
                  )}
                  {!collapsed && item.badge ? (
                    <span className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-black ${isActive ? "bg-white/30 text-white" : "bg-brand-teal/15 text-brand-teal"}`}>
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar footer */}
        <div className={`space-y-4 border-t p-5 transition-colors ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          {!collapsed && (
            <div className="hidden items-start gap-3 md:flex">
              {profile.image ? (
                <div className="h-10 w-10 shrink-0 rounded-xl bg-cover bg-center ring-2 ring-brand-teal/20" style={{ backgroundImage: `url(${profile.image})` }} role="img" aria-label={`${profile.name} profile image`} />
              ) : (
                <AvatarInitials name={profile.name} dark={isDark} />
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">
                  {isDoctor ? "Clinical account" : "Patient account"}
                </p>
                <div className="mt-1 flex items-center gap-1.5 min-w-0">
                  <p className="truncate text-sm font-black">{profile.name}</p>
                  {profile.isVerified && (
                    <span
                      title="Verified Doctor Account"
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-brand-teal"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7z" />
                        <path d="m9 12 2 2 4-4" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </div>
                <p className={`truncate text-xs font-medium ${muted}`}>{profile.detail}</p>
                {profile.meta && <p className={`mt-1 text-[10px] font-bold ${muted}`}>{profile.meta}</p>}
              </div>
            </div>
          )}
          <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
            <div className={collapsed ? "w-full [&>*]:w-full" : "flex-1"}>{onLogout()}</div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Sticky header */}
        <header className={`sticky top-0 z-30 border-b ${headerBg} backdrop-blur-xl`}>
          <div className="px-4 py-3 lg:px-8">
            <div className="flex items-center justify-between gap-3">
              {/* Left: hamburger + brand + title */}
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors md:hidden ${
                    isDark
                      ? "border-slate-700 text-slate-300 hover:bg-slate-800 active:bg-slate-700"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                  }`}
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Open mobile navigation"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h10" />
                  </svg>
                </button>

                {/* Brand wordmark on mobile with responsive logo emblem */}
                <div className="flex select-none items-center gap-2 md:hidden">
                  <div
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition-all ${
                      isDark ? "border-slate-700 bg-slate-900 shadow-2xs" : "border-slate-200 bg-white shadow-2xs"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 4v16m-8-8h16" stroke="#E02424" />
                      <circle cx="12" cy="12" r="2.8" stroke="#0E9F6E" strokeWidth="2" fill={isDark ? "#0f172a" : "#ffffff"} />
                    </svg>
                  </div>
                  <span className="font-display text-lg tracking-tight leading-none">
                    <span className="font-black text-brand-red">H</span>
                    <span className={`font-extrabold transition-colors duration-200 ${isDark ? "text-white" : "text-slate-900"}`}>ealth</span>
                    <span className="font-black text-brand-teal">K</span>
                    <span className={`font-extrabold transition-colors duration-200 ${isDark ? "text-white" : "text-slate-900"}`}>o</span>
                  </span>
                </div>

                {/* Title section (hidden on mobile, shown on md+) */}
                <div className="hidden min-w-0 md:block">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">{subtitle}</p>
                  <h1 className="mt-0.5 font-display text-2xl font-black tracking-tight">{title}</h1>
                </div>
              </div>

              {/* Right: theme toggle + status + bell + avatar */}
              <div className="flex items-center gap-2">
                {onToggleTheme && (
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className={`grid h-10 w-10 place-items-center rounded-xl border transition-all ${
                      isDark
                        ? "border-slate-700 bg-slate-900 text-amber-300 hover:bg-slate-800 hover:text-amber-200 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs"
                    }`}
                    title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                  >
                    {isDark ? (
                      <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                      </svg>
                    ) : (
                      <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                      </svg>
                    )}
                  </button>
                )}
                {statusIndicator}
                {notificationBell}
                {/* Avatar on mobile */}
                <div className="md:hidden">
                  {profile.image ? (
                    <div className="h-9 w-9 rounded-xl bg-cover bg-center ring-2 ring-brand-teal/20" style={{ backgroundImage: `url(${profile.image})` }} />
                  ) : (
                    <AvatarInitials name={profile.name} dark={isDark} />
                  )}
                </div>
              </div>
            </div>

            {/* Page title on mobile (below the top bar) */}
            <div className="mt-2 md:hidden">
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-brand-teal">{subtitle}</p>
              <h1 className="mt-0.5 font-display text-xl font-black tracking-tight">{title}</h1>
            </div>

            {/* Connection status */}
            {connectionState !== "connected" && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800" role="status">
                Live updates are reconnecting. Your current work is still visible.
              </div>
            )}

            {/* Mobile tab nav strip */}
            <nav
              className={`mt-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5 md:hidden`}
              aria-label="Mobile module navigation"
            >
              {navItems.map((item) => {
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                    }}
                    className={`relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black transition-all active:scale-[0.97] ${
                      isActive
                        ? "bg-brand-teal text-white shadow-sm shadow-brand-teal/30"
                        : isDark
                          ? "bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white"
                          : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                    }`}
                  >
                    <NavIcon id={item.id} />
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className={`rounded-full px-1 text-[9px] font-black ${isActive ? "bg-white/30" : "bg-brand-teal/20 text-brand-teal"}`}>
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
