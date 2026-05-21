"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownToLine, Plus, List, LayoutDashboard } from "lucide-react";
import { SegmentedControl } from "./SegmentedControl";

interface Client  { id: string; name: string }
interface Member  { id: string; name: string }
type BillingFilter = "RETAINERSHIP" | "OUT_OF_RETAINERSHIP" | "INTERNAL" | "";

interface TopBarProps {
  view: "table" | "dashboard";
  onViewChange: (v: "table" | "dashboard") => void;
  startDate: string;
  onStartDateChange: (d: string) => void;
  endDate: string;
  onEndDateChange: (d: string) => void;
  clients: Client[];
  clientFilter: string;
  onClientFilterChange: (id: string) => void;
  billingFilter: BillingFilter;
  onBillingFilterChange: (v: BillingFilter) => void;
  members: Member[];
  memberFilter: string;
  onMemberFilterChange: (id: string) => void;
  onNewEntry: () => void;
}

const VIEW_OPTIONS = [
  { value: "table"     as const, label: "Table",     icon: List },
  { value: "dashboard" as const, label: "Dashboard",  icon: LayoutDashboard },
];

const BILLING_OPTIONS: { value: BillingFilter; label: string }[] = [
  { value: "",                    label: "All Billing" },
  { value: "RETAINERSHIP",        label: "Retainership" },
  { value: "OUT_OF_RETAINERSHIP", label: "Out of Retainership" },
  { value: "INTERNAL",            label: "Internal" },
];

const filterSelectStyle: React.CSSProperties = {
  background:   "var(--bg-ground)",
  border:       "1px solid var(--border-subtle)",
  borderRadius: 6,
  color:        "var(--text-primary)",
  fontFamily:   "var(--font-instrument-sans)",
  fontSize:     13,
  height:       32,
  outline:      "none",
  padding:      "0 10px",
  cursor:       "pointer",
};

function ExportButton() {
  const [iconHovered, setIconHovered] = useState(false);
  return (
    <Link href="/export">
      <motion.div
        className="flex items-center gap-1.5"
        style={{
          background:   "var(--bg-ground)",
          border:       "1.5px solid var(--border-medium)",
          borderRadius: 8,
          height:       36,
          padding:      "0 14px",
          fontSize:     13,
          fontFamily:   "var(--font-instrument-sans)",
          fontWeight:   500,
          color:        "var(--text-primary)",
          cursor:       "pointer",
        }}
        whileHover={{ background: "var(--bg-hover)", borderColor: "var(--border-strong)" } as never}
        whileTap={{ scale: 0.97 }}
        onMouseEnter={() => setIconHovered(true)}
        onMouseLeave={() => setIconHovered(false)}
      >
        <motion.div
          animate={{ y: iconHovered ? 2 : 0 }}
          transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ display: "flex", alignItems: "center" }}
        >
          <ArrowDownToLine size={14} strokeWidth={1.5} />
        </motion.div>
        Export
      </motion.div>
    </Link>
  );
}

function NewEntryButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-1.5"
      style={{
        background:   "var(--bg-ink)",
        color:        "var(--text-on-dark)",
        border:       "none",
        borderRadius: 8,
        height:       36,
        padding:      "0 16px",
        fontSize:     14,
        fontFamily:   "var(--font-instrument-sans)",
        fontWeight:   500,
        cursor:       "pointer",
        display:      "flex",
        alignItems:   "center",
        gap:          6,
        boxShadow:    "var(--shadow-sm)",
      }}
      whileHover={{ opacity: 0.88 }}
      whileTap={{ scale: 0.97, transition: { duration: 0.08 } }}
    >
      <motion.div
        animate={{ rotate: hovered ? 45 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        style={{ display: "flex", alignItems: "center" }}
      >
        <Plus size={14} strokeWidth={1.5} />
      </motion.div>
      New Entry
    </motion.button>
  );
}

export function TopBar({
  view, onViewChange,
  startDate, onStartDateChange,
  endDate, onEndDateChange,
  clients, clientFilter, onClientFilterChange,
  billingFilter, onBillingFilterChange,
  members, memberFilter, onMemberFilterChange,
  onNewEntry,
}: TopBarProps) {
  return (
    <header
      className="top-bar filters"
      style={{
        position:     "sticky",
        top:          0,
        zIndex:       20,
        height:       60,
        background:   "var(--bg-surface)",
        borderBottom: "1px solid var(--border-ghost)",
        boxShadow:    "var(--shadow-sm)",
        padding:      "0 48px",
        display:      "flex",
        alignItems:   "center",
        gap:          12,
      }}
    >
      {/* Left cluster: filters */}
      <div className="hidden md:flex items-center gap-2 flex-1">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          style={{ ...filterSelectStyle, width: 148 }}
        />
        <span style={{ fontFamily: "var(--font-martian-mono)", fontSize: 12, color: "var(--text-muted)" }}>–</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          style={{ ...filterSelectStyle, width: 148 }}
        />

        <select value={clientFilter} onChange={(e) => onClientFilterChange(e.target.value)} style={filterSelectStyle}>
          <option value="">All Clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={billingFilter}
          onChange={(e) => onBillingFilterChange(e.target.value as BillingFilter)}
          style={filterSelectStyle}
        >
          {BILLING_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        <select value={memberFilter} onChange={(e) => onMemberFilterChange(e.target.value)} style={filterSelectStyle}>
          <option value="">All Members</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Right cluster: view + actions */}
      <div className="flex items-center gap-2 ml-auto">
        <SegmentedControl id="view" value={view} onChange={onViewChange} options={VIEW_OPTIONS} />
        <ExportButton />
        <NewEntryButton onClick={onNewEntry} />
      </div>
    </header>
  );
}
