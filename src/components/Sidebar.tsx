"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Download, Trash2, Users,
  FolderKanban, LogOut, UserCircle, Sun, Moon,
} from "lucide-react";

const mainNav = [
  { href: "/timesheet",          label: "Timesheet",         icon: Clock },
  { href: "/export",             label: "Export",            icon: Download },
  { href: "/trash",              label: "Trash",             icon: Trash2 },
];

const settingsNav = [
  { href: "/settings/projects",  label: "Clients & Projects", icon: FolderKanban },
  { href: "/settings/team",      label: "Team Members",       icon: Users },
  { href: "/settings/account",   label: "Account",            icon: UserCircle },
];

const mobileNav = [
  { href: "/timesheet",          icon: Clock,         label: "Timesheet" },
  { href: "/export",             icon: Download,      label: "Export" },
  { href: "/trash",              icon: Trash2,        label: "Trash" },
  { href: "/settings/projects",  icon: FolderKanban,  label: "Projects" },
  { href: "/settings/account",   icon: UserCircle,    label: "Account" },
];

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const [hovered, setHovered] = useState(false);
  const lit = isActive || hovered;

  return (
    <Link
      href={href}
      className="relative block"
      style={{ borderRadius: 8 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isActive && (
        <motion.div
          layoutId="nav-indicator"
          className="absolute left-0 top-0 bottom-0"
          style={{ width: 2, background: "var(--text-primary)", borderRadius: "0 2px 2px 0" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      <div
        className="flex items-center"
        style={{
          height:     40,
          padding:    "0 10px",
          gap:        12,
          color:      lit ? "var(--text-primary)" : "var(--text-secondary)",
          transition: "color 150ms var(--ease-standard)",
          borderRadius: 8,
          background: isActive ? "var(--bg-hover)" : "transparent",
        }}
      >
        <motion.div
          animate={{ x: hovered ? 2 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          style={{ display: "flex", alignItems: "center" }}
        >
          <Icon size={16} strokeWidth={1.5} />
        </motion.div>
        <span style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 14, fontWeight: 500 }}>
          {label}
        </span>
      </div>
    </Link>
  );
}

// ─── Mobile nav item ──────────────────────────────────────────────────────────

function MobileNavItem({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      aria-label={label}
      className="relative flex flex-col items-center justify-center flex-1"
      style={{ height: "100%" }}
    >
      {isActive && (
        <motion.div
          layoutId="bottom-dot"
          className="absolute top-2 left-1/2 -translate-x-1/2"
          style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text-primary)" }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        />
      )}
      <div style={{
        color:      isActive ? "var(--text-primary)" : "var(--text-secondary)",
        transition: "color 150ms var(--ease-standard)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={20} strokeWidth={1.5} />
      </div>
    </Link>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily:    "var(--font-martian-mono)",
      fontSize:      10,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      color:         "var(--text-muted)",
      padding:       "0 10px",
      marginTop:     12,
      marginBottom:  2,
      opacity:       0.7,
      lineHeight:    "16px",
    }}>
      {children}
    </div>
  );
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [hovered, setHovered] = useState(false);

  if (!mounted) return <div style={{ height: 40 }} />;

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height:       40,
        padding:      "0 10px",
        display:      "flex",
        alignItems:   "center",
        gap:          12,
        width:        "100%",
        borderRadius: 8,
        border:       "none",
        background:   "transparent",
        cursor:       "pointer",
        color:        hovered ? "var(--text-secondary)" : "var(--text-muted)",
        transition:   "color 150ms var(--ease-standard)",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={isDark ? "sun" : "moon"}
          initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.2 }}
          style={{ display: "flex", alignItems: "center" }}
        >
          {isDark ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
        </motion.div>
      </AnimatePresence>
      <span style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 14, fontWeight: 500 }}>
        {isDark ? "Light mode" : "Dark mode"}
      </span>
    </button>
  );
}

// ─── Sign out ─────────────────────────────────────────────────────────────────

function SignOutButton() {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height:       40,
        padding:      "0 10px",
        display:      "flex",
        alignItems:   "center",
        gap:          12,
        width:        "100%",
        borderRadius: 8,
        border:       "none",
        background:   "transparent",
        cursor:       "pointer",
        color:        hovered ? "var(--text-secondary)" : "var(--text-muted)",
        transition:   "color 150ms var(--ease-standard)",
      }}
    >
      <motion.div
        animate={{ x: hovered ? 2 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        style={{ display: "flex", alignItems: "center" }}
      >
        <LogOut size={16} strokeWidth={1.5} />
      </motion.div>
      <span style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 14, fontWeight: 500 }}>
        Sign Out
      </span>
    </button>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar() {
  return (
    <>
      {/* Desktop sidebar — light parchment */}
      <aside
        className="paper-grain hidden md:flex flex-col sidebar"
        style={{
          width:       224,
          minHeight:   "100vh",
          position:    "fixed",
          left:        0,
          top:         0,
          bottom:      0,
          zIndex:      40,
          background:  "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-ghost)",
          padding:     "24px 16px",
        }}
      >
        {/* Wordmark */}
        <div style={{ paddingLeft: 10 }}>
          <span
            className="font-fraunces"
            style={{
              display:               "block",
              fontVariationSettings: "'opsz' 48, 'WONK' 0",
              fontWeight:            700,
              fontSize:              20,
              lineHeight:            "24px",
              letterSpacing:         "-0.01em",
              color:                 "var(--text-primary)",
            }}
          >
            CHRONICLE
          </span>
          <p style={{
            fontFamily:    "var(--font-martian-mono)",
            fontSize:      10,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color:         "var(--text-muted)",
            marginTop:     5,
          }}>
            Goku Studio
          </p>
        </div>

        {/* Nav */}
        <nav style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 1 }}>
          {mainNav.map((item) => <NavItem key={item.href} {...item} />)}
          <SectionLabel>Settings</SectionLabel>
          {settingsNav.map((item) => <NavItem key={item.href} {...item} />)}
        </nav>

        {/* Bottom */}
        <div style={{
          marginTop:  "auto",
          paddingTop: 16,
          borderTop:  "1px solid var(--border-ghost)",
          display:    "flex",
          flexDirection: "column",
          gap:        2,
        }}>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch paper-grain"
        style={{
          background:  "var(--bg-sidebar)",
          borderTop:   "1px solid var(--border-ghost)",
          boxShadow:   "0 -1px 8px rgba(42,31,20,0.06)",
          height:      "calc(56px + env(safe-area-inset-bottom))",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {mobileNav.map((item) => <MobileNavItem key={item.href} {...item} />)}
      </nav>
    </>
  );
}
