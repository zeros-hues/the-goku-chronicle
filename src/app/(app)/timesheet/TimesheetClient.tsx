"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { BillingType } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Download, Pencil, Trash2, LayoutDashboard, List, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getEntries, softDeleteEntry } from "@/app/actions/entries";
import DashboardView from "./DashboardView";
import EditEntryModal from "./EditEntryModal";
import PageMotion from "@/components/PageMotion";

type Member = { id: string; name: string; initials: string; isActive: boolean };
type Project = {
  id: string; name: string; billingType: BillingType;
  archivedAt: Date | null; clientId: string;
};
type Client = { id: string; name: string; hasRetainership: boolean; projects: Project[]; createdAt: Date };
type TaskHour = { teamMemberId: string; hours: number; teamMember: Member };
type Entry = {
  id: string; date: Date; projectId: string | null;
  project: (Project & { client: Client }) | null;
  taskDescription: string; isMeeting: boolean;
  personCount: number | null; meetingDuration: number | null;
  billingOverride: BillingType | null; taskHours: TaskHour[];
};

const BILLING_LABELS: Record<BillingType, string> = {
  RETAINERSHIP: "Retainership",
  OUT_OF_RETAINERSHIP: "Out of Retainership",
  INTERNAL: "Internal",
};

// Project pill colours (Appasamy = ink navy, Goku = charcoal, future = grey tones)
const CLIENT_PILL: Record<number, { bg: string; text: string }> = {
  0: { bg: "#1E3A5F", text: "#93C5FD" },   // Appasamy
  1: { bg: "#2A2A28", text: "#D1D5DB" },   // Goku Studio
  2: { bg: "#1F2D1A", text: "#86EFAC" },
  3: { bg: "#2D1F0A", text: "#FCD34D" },
  4: { bg: "#2D0A0A", text: "#FCA5A5" },
};

function ProjectPill({ name, clientIndex }: { name: string; clientIndex: number }) {
  const style = CLIENT_PILL[clientIndex] ?? { bg: "#222220", text: "#9C9A96" };
  return (
    <motion.span
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="inline-flex items-center px-2 py-0.5 font-medium"
      style={{
        background: style.bg, color: style.text,
        fontSize: 11, borderRadius: 4, whiteSpace: "nowrap",
      }}
    >
      {name}
    </motion.span>
  );
}

function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr>
      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
      <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded" /></td>
      <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3"><Skeleton className="h-4 w-8 mx-auto" /></td>
      ))}
      <td className="px-4 py-3"><Skeleton className="h-4 w-8 ml-auto" /></td>
    </tr>
  );
}

export default function TimesheetClient({
  clients, members,
}: { clients: Client[]; members: Member[] }) {
  const [view, setView] = useState<"table" | "dashboard">("table");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const now = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [clientFilter, setClientFilter] = useState("");
  const [billingFilter, setBillingFilter] = useState<BillingType | "">("");
  const [memberFilter, setMemberFilter] = useState("");

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const data = await getEntries({
      startDate, endDate,
      clientId: clientFilter || undefined,
      billingType: billingFilter || undefined,
      teamMemberId: memberFilter || undefined,
    });
    setEntries(data as unknown as Entry[]);
    setLoading(false);
  }, [startDate, endDate, clientFilter, billingFilter, memberFilter]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  async function handleDelete(id: string) {
    await softDeleteEntry(id);
    setDeleteTarget(null);
    toast.success("Entry moved to trash");
    await loadEntries();
  }

  const grouped = entries.reduce((acc, entry) => {
    const key = format(new Date(entry.date), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {} as Record<string, Entry[]>);
  const sortedDates = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  function getClientIndex(clientId: string) {
    return clients.findIndex((c) => c.id === clientId);
  }

  const selectStyle = {
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    fontSize: 13,
    padding: "6px 10px",
    borderRadius: 4,
    outline: "none",
  };

  return (
    <PageMotion>
      <div className="p-5 md:p-7">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {/* Date range — always visible */}
          <div className="flex items-center gap-1.5">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              style={{ ...selectStyle, fontFamily: "var(--font-geist-mono)", fontSize: 12 }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>–</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              style={{ ...selectStyle, fontFamily: "var(--font-geist-mono)", fontSize: 12 }} />
          </div>

          {/* Filters — hidden on mobile, shown in sheet */}
          <div className="hidden md:flex items-center gap-2">
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} style={selectStyle}>
              <option value="">All Clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={billingFilter} onChange={(e) => setBillingFilter(e.target.value as BillingType | "")} style={selectStyle}>
              <option value="">All Billing</option>
              {Object.entries(BILLING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} style={selectStyle}>
              <option value="">All Members</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {/* Mobile filter button */}
          <motion.button
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5"
            style={{ ...selectStyle }}
            onClick={() => setShowFilters(!showFilters)}
            whileTap={{ scale: 0.97 }}
          >
            <Filter size={13} />
            <span style={{ fontSize: 12 }}>Filters</span>
          </motion.button>

          <div className="ml-auto flex items-center gap-2">
            {/* View toggle */}
            <div
              className="inline-flex items-center"
              style={{ border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden", background: "var(--card-bg)" }}
            >
              {(["table", "dashboard"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="relative flex items-center gap-1.5 px-3 py-1.5"
                  style={{ fontSize: 12, fontWeight: 500, position: "relative" }}
                >
                  {view === v && (
                    <motion.div
                      layoutId="view-toggle-bg"
                      className="absolute inset-0"
                      style={{ background: "var(--action-primary)", borderRadius: 2 }}
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  <span className="relative" style={{ color: view === v ? "var(--action-primary-text)" : "var(--text-secondary)" }}>
                    {v === "table" ? <List size={13} /> : <LayoutDashboard size={13} />}
                  </span>
                  <span className="relative" style={{ color: view === v ? "var(--action-primary-text)" : "var(--text-secondary)" }}>
                    {v === "table" ? "Table" : "Dashboard"}
                  </span>
                </button>
              ))}
            </div>

            <Link href="/export">
              <motion.div
                className="flex items-center gap-1.5 px-3 py-1.5"
                style={{
                  border: "1px solid var(--border)", borderRadius: 4,
                  background: "transparent", color: "var(--text-primary)", fontSize: 12, fontWeight: 500,
                }}
                whileHover={{ background: "var(--accent-bg)" }}
                whileTap={{ scale: 0.97 }}
              >
                <motion.div whileHover={{ y: 2 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                  <Download size={13} />
                </motion.div>
                Export
              </motion.div>
            </Link>

            <Link href="/timesheet/new">
              <motion.div
                className="flex items-center gap-1.5 px-4 py-1.5 group"
                style={{
                  background: "var(--action-primary)", color: "var(--action-primary-text)",
                  borderRadius: 4, fontSize: 13, fontWeight: 500,
                }}
                whileHover={{ opacity: 0.88 }}
                whileTap={{ scale: 0.97 }}
              >
                <motion.div
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  whileHover={{ rotate: 90 }}
                >
                  <Plus size={14} />
                </motion.div>
                New Entry
              </motion.div>
            </Link>
          </div>
        </div>

        {/* Mobile filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden mb-4"
            >
              <div className="flex flex-col gap-2 p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 4 }}>
                <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} style={selectStyle} className="w-full">
                  <option value="">All Clients</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={billingFilter} onChange={(e) => setBillingFilter(e.target.value as BillingType | "")} style={selectStyle} className="w-full">
                  <option value="">All Billing</option>
                  {Object.entries(BILLING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} style={selectStyle} className="w-full">
                  <option value="">All Members</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {view === "dashboard" ? (
          <DashboardView entries={entries as never} members={members} clients={clients as never} />
        ) : (
          <>
            {loading ? (
              <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 4 }}>
                <table className="w-full text-sm">
                  <tbody>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <TableRowSkeleton key={i} cols={members.length} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : entries.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20"
                style={{ border: "1px solid var(--border)", borderRadius: 4, background: "var(--card-bg)" }}
              >
                <p className="font-mono mb-4" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  No entries
                </p>
                <Link href="/timesheet/new">
                  <motion.div
                    className="flex items-center gap-2 px-4 py-2"
                    style={{ background: "var(--action-primary)", color: "var(--action-primary-text)", borderRadius: 4, fontSize: 13, fontWeight: 500 }}
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ opacity: 0.88 }}
                  >
                    <Plus size={14} />
                    Add Entry
                  </motion.div>
                </Link>
              </motion.div>
            ) : (
              <div
                className="overflow-x-auto"
                style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 4 }}
              >
                <table className="w-full text-sm" style={{ minWidth: 700 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Date", "Day", "Project", "Task", ...members.map((m) => m.initials), "Total"].map((h, i) => (
                        <th
                          key={i}
                          className="font-mono text-left px-4 py-3"
                          style={{
                            fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
                            color: "var(--text-muted)", fontWeight: 500,
                            textAlign: i >= 4 ? "center" : "left",
                            position: i < 2 ? "sticky" : undefined,
                            left: i === 0 ? 0 : i === 1 ? 64 : undefined,
                            background: "var(--card-bg)",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                      <th className="w-14" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDates.map((dateKey) => {
                      const dayEntries = grouped[dateKey];
                      const date = new Date(dateKey + "T00:00:00");
                      const dateLabel = format(date, "dd MMM");
                      const dayLabel = format(date, "EEE");

                      const dayTotal = dayEntries.reduce((sum, e) => {
                        if (e.isMeeting) return sum + (e.meetingDuration ?? 0);
                        return sum + e.taskHours.reduce((s, th) => s + th.hours, 0);
                      }, 0);

                      const memberDayTotals = members.reduce((acc, m) => {
                        acc[m.id] = dayEntries.reduce((sum, e) => {
                          const th = e.taskHours.find((h) => h.teamMemberId === m.id);
                          return sum + (th?.hours ?? 0);
                        }, 0);
                        return acc;
                      }, {} as Record<string, number>);

                      return [
                        ...dayEntries.map((entry, entryIdx) => {
                          const clientIdx = entry.project
                            ? getClientIndex(entry.project.clientId)
                            : -1;
                          const entryTotal = entry.isMeeting
                            ? (entry.meetingDuration ?? 0)
                            : entry.taskHours.reduce((s, th) => s + th.hours, 0);

                          return (
                            <motion.tr
                              key={entry.id}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: entryIdx * 0.03, duration: 0.15 }}
                              className="group relative cursor-pointer"
                              onClick={() => setEditEntry(entry)}
                              style={{ borderBottom: "1px solid var(--border)" }}
                              whileHover={{ backgroundColor: "var(--accent-bg)" } as never}
                            >
                              {entryIdx === 0 && (
                                <>
                                  <td
                                    rowSpan={dayEntries.length + 1}
                                    className="px-4 py-3 align-top"
                                    style={{
                                      fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                                      position: "sticky", left: 0, background: "var(--card-bg)",
                                      borderRight: "1px solid var(--border)",
                                    }}
                                  >
                                    {dateLabel}
                                  </td>
                                  <td
                                    rowSpan={dayEntries.length + 1}
                                    className="px-4 py-3 align-top font-mono"
                                    style={{
                                      fontSize: 12, color: "var(--text-muted)",
                                      position: "sticky", left: 64, background: "var(--card-bg)",
                                    }}
                                  >
                                    {dayLabel}
                                  </td>
                                </>
                              )}

                              <td className="px-4 py-3">
                                {entry.project ? (
                                  <ProjectPill name={entry.project.name} clientIndex={clientIdx} />
                                ) : (
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 font-medium"
                                    style={{ background: "var(--accent-bg)", color: "var(--text-muted)", fontSize: 11, borderRadius: 4 }}
                                  >
                                    Internal
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3" style={{ fontSize: 14, color: "var(--text-primary)" }}>
                                {entry.taskDescription}
                              </td>

                              {entry.isMeeting ? (
                                <td colSpan={members.length} className="px-4 py-3 text-center font-mono"
                                  style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                                  Meeting — {entry.personCount} persons
                                </td>
                              ) : (
                                members.map((m) => {
                                  const th = entry.taskHours.find((h) => h.teamMemberId === m.id);
                                  return (
                                    <td key={m.id} className="px-3 py-3 text-center font-mono"
                                      style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                                      {th ? th.hours : ""}
                                    </td>
                                  );
                                })
                              )}

                              <td className="px-4 py-3 text-right font-mono"
                                style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                                {entryTotal > 0 ? entryTotal : ""}
                              </td>

                              <td className="px-2 py-3">
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <motion.button
                                    onClick={(e) => { e.stopPropagation(); setEditEntry(entry); }}
                                    whileHover={{ rotate: -10, scale: 1.1 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                    className="p-1.5"
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    <Pencil size={13} />
                                  </motion.button>
                                  <motion.button
                                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(entry.id); }}
                                    whileHover={{ scale: 1.15, color: "var(--destructive)" }}
                                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                    className="p-1.5"
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    <Trash2 size={13} />
                                  </motion.button>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        }),

                        // Day total row
                        <tr key={`total-${dateKey}`} style={{ borderBottom: "2px solid var(--border-strong)" }}>
                          <td colSpan={2} className="px-4 py-2 font-mono"
                            style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                            Total
                          </td>
                          {members.map((m) => (
                            <td key={m.id} className="px-3 py-2 text-center font-mono"
                              style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                              {memberDayTotals[m.id] > 0 ? memberDayTotals[m.id] : ""}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right font-mono"
                            style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                            {dayTotal}
                          </td>
                          <td />
                        </tr>,
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Edit modal */}
        {editEntry && (
          <EditEntryModal
            entry={editEntry}
            clients={clients}
            members={members}
            onClose={() => setEditEntry(null)}
            onSaved={async () => {
              setEditEntry(null);
              await loadEntries();
            }}
          />
        )}

        {/* Delete confirm */}
        <AnimatePresence>
          {deleteTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => setDeleteTarget(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="p-6 max-w-xs w-full mx-4"
                style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 6 }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="font-mono mb-1" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Move to Trash
                </p>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
                  This entry can be restored from Trash later.
                </p>
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => handleDelete(deleteTarget)}
                    className="flex-1 py-2 font-medium"
                    style={{ background: "var(--destructive)", color: "#fff", borderRadius: 4, fontSize: 13 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Move to Trash
                  </motion.button>
                  <motion.button
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 py-2 font-medium"
                    style={{ background: "var(--accent-bg)", color: "var(--text-primary)", borderRadius: 4, fontSize: 13 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageMotion>
  );
}
