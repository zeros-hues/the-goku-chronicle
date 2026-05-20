"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Download,
  Trash2,
  Users,
  FolderKanban,
  LogOut,
  UserCircle,
  Settings,
  Sun,
  Moon,
} from "lucide-react";

const mainNav = [
  { href: "/timesheet", label: "Timesheet", icon: Clock },
  { href: "/export", label: "Export", icon: Download },
  { href: "/trash", label: "Trash", icon: Trash2 },
];

const settingsNav = [
  { href: "/settings/projects", label: "Clients & Projects", icon: FolderKanban },
  { href: "/settings/team", label: "Team Members", icon: Users },
  { href: "/settings/account", label: "Account", icon: UserCircle },
];

const mobileNav = [
  { href: "/timesheet", icon: Clock },
  { href: "/export", icon: Download },
  { href: "/trash", icon: Trash2 },
  { href: "/settings/projects", icon: Settings },
  { href: "/settings/account", icon: UserCircle },
];

function NavItem({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link href={href} className="relative flex items-center group">
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="sidebar-indicator"
          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full"
          style={{ background: "#E8E6E0" }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        />
      )}

      <motion.div
        className="flex items-center gap-3 pl-4 pr-3 py-2.5 w-full rounded-sm"
        animate={{
          color: isActive ? "#E8E6E0" : "#6B6966",
        }}
        whileHover={{ x: 2 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <motion.div whileHover={{ scale: 1.15 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
          <Icon size={15} />
        </motion.div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </span>
      </motion.div>
    </Link>
  );
}

function MobileNavItem({ href, icon: Icon }: { href: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link href={href} className="relative flex flex-col items-center justify-center flex-1 py-3">
      {isActive && (
        <motion.div
          layoutId="mobile-indicator"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
          style={{ background: "#E8E6E0" }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        />
      )}
      <motion.div
        animate={{ color: isActive ? "#E8E6E0" : "#6B6966" }}
        whileHover={{ scale: 1.15 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        <Icon size={20} />
      </motion.div>
    </Link>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <motion.button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center gap-3 pl-4 pr-3 py-2.5 w-full rounded-sm"
      style={{ color: "#6B6966", fontSize: 13, fontWeight: 500 }}
      whileHover={{ color: "#E8E6E0", x: 2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={isDark ? "moon" : "sun"}
          initial={{ scale: 0, rotate: 90 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: -90 }}
          transition={{ duration: 0.15 }}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </motion.div>
      </AnimatePresence>
      {isDark ? "Light mode" : "Dark mode"}
    </motion.button>
  );
}

export default function Sidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-[220px] min-h-screen fixed left-0 top-0 bottom-0 z-40 sidebar-noise"
        style={{ background: "var(--sidebar-bg)" }}
      >
        {/* Header */}
        <div className="px-4 py-5">
          <p
            className="font-mono"
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: "var(--sidebar-text)",
              textTransform: "uppercase",
            }}
          >
            CHRONICLE
          </p>
          <p
            className="mt-0.5"
            style={{ fontSize: 11, color: "var(--sidebar-muted)" }}
          >
            Goku Studio
          </p>
        </div>

        {/* Separator */}
        <div
          className="mx-4 mb-3"
          style={{ height: 1, background: "rgba(232,230,224,0.08)" }}
        />

        <nav className="flex-1 px-1 space-y-0.5">
          {mainNav.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}

          <div className="pt-5 pb-1 px-4">
            <p
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--sidebar-muted)",
                opacity: 0.6,
              }}
            >
              Settings
            </p>
          </div>

          {settingsNav.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </nav>

        {/* Bottom */}
        <div
          className="px-1 py-3 mx-3 mt-2"
          style={{ borderTop: "1px solid rgba(232,230,224,0.08)" }}
        >
          <ThemeToggle />
          <motion.button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 pl-4 pr-3 py-2.5 w-full rounded-sm"
            style={{ color: "#6B6966", fontSize: 13, fontWeight: 500 }}
            whileHover={{ color: "#E8E6E0", x: 2 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <motion.div whileHover={{ scale: 1.15 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
              <LogOut size={15} />
            </motion.div>
            Sign Out
          </motion.button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center"
        style={{
          background: "var(--sidebar-bg)",
          borderTop: "1px solid rgba(232,230,224,0.1)",
          height: 56,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {mobileNav.map((item) => (
          <MobileNavItem key={item.href} {...item} />
        ))}
      </nav>
    </>
  );
}
