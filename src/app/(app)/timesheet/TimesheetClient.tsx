"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { BillingType } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, Copy,
  ArrowUp, ArrowDown, ChevronsUpDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getEntries, softDeleteEntry, bulkSoftDelete, bulkRestore,
} from "@/app/actions/entries";
import DashboardView from "./DashboardView";
import EditEntryModal from "./EditEntryModal";
import PageMotion from "@/components/PageMotion";
import { TopBar } from "@/components/TopBar";
import { ProjectPillStatic } from "@/components/chronicle/ProjectPill";
import { ImportDialog } from "@/components/ImportDialog";
import DuplicateEntrySheet from "./DuplicateEntrySheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type Member   = { id: string; name: string; initials: string; isActive: boolean };
type Project  = { id: string; name: string; billingType: BillingType; archivedAt: Date | null; clientId: string };
type Client   = { id: string; name: string; hasRetainership: boolean; projects: Project[]; createdAt: Date };
type TaskHour = { teamMemberId: string; hours: number; teamMember: Member };
type Entry    = {
  id: string; date: Date; projectId: string | null;
  project: (Project & { client: Client }) | null;
  taskDescription: string; isMeeting: boolean;
  personCount: number | null; meetingDuration: number | null;
  billingOverride: BillingType | null; taskHours: TaskHour[];
  createdAt: Date;
};
type SortField = "date" | "project" | "hours" | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(d: Date | string): string {
  const s = typeof d === "string" ? d : d.toISOString();
  return s.substring(0, 10);
}

function entryHoursTotal(e: Entry): number {
  if (e.isMeeting) return e.meetingDuration ?? 0;
  return e.taskHours.reduce((s, th) => s + th.hours, 0);
}

function effectiveBilling(e: Entry): BillingType {
  return e.billingOverride ?? e.project?.billingType ?? BillingType.INTERNAL;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HoursCell({ hours }: { hours: number }) {
  if (!hours || hours <= 0) return <span style={{ fontFamily: "var(--font-martian-mono)", opacity: 0.35 }}>—</span>;
  return (
    <>
      <span style={{ fontFamily: "var(--font-martian-mono)", fontWeight: 500 }}>{hours}</span>
      <span style={{ fontFamily: "var(--font-martian-mono)", fontWeight: 400, opacity: 0.55, fontSize: 12 }}>h</span>
    </>
  );
}

function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr>
      <td style={{ padding: "0 8px", height: 56 }}><Skeleton className="h-4 w-4 mx-auto" /></td>
      <td style={{ padding: "0 16px", height: 56 }}><Skeleton className="h-4 w-16" /></td>
      <td style={{ padding: "0 16px", height: 56 }}><Skeleton className="h-4 w-8" /></td>
      <td style={{ padding: "0 16px", height: 56 }}><Skeleton className="h-[22px] w-20 rounded-[3px]" /></td>
      <td style={{ padding: "0 16px", height: 56 }}><Skeleton className="h-4 w-48" /></td>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "0 16px", height: 56 }}><Skeleton className="h-4 w-8 ml-auto" /></td>
      ))}
      <td style={{ padding: "0 16px", height: 56 }}><Skeleton className="h-4 w-8 ml-auto" /></td>
    </tr>
  );
}

function BillingBadge({ type }: { type: BillingType }) {
  const label = type === BillingType.RETAINERSHIP ? "Retainership"
    : type === BillingType.OUT_OF_RETAINERSHIP ? "Out of Retainer"
    : "Internal";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", height: 20,
      padding: "0 8px", borderRadius: 4,
      background: "var(--bg-hover)", border: "1px solid var(--border-ghost)",
      fontFamily: "var(--font-martian-mono)", fontSize: 9, fontWeight: 500,
      letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)",
    }}>
      {label}
    </span>
  );
}

function SortIcon({ field, sortField, sortDir }: { field: string; sortField: SortField; sortDir: "asc" | "desc" }) {
  const isActive = sortField === field;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", marginLeft: 4, opacity: isActive ? 1 : 0.35 }}>
      {!isActive
        ? <ChevronsUpDown size={9} />
        : sortDir === "asc"
          ? <ArrowUp size={9} />
          : <ArrowDown size={9} />
      }
    </span>
  );
}

// ─── th style ─────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  fontFamily:    "var(--font-martian-mono)",
  fontSize:      11,
  fontWeight:    500,
  textTransform: "uppercase",
  letterSpacing: "0.10em",
  color:         "var(--text-muted)",
  padding:       "14px 16px",
  fontVariantNumeric: "tabular-nums",
};

const thSortStyle: React.CSSProperties = {
  ...thStyle,
  cursor: "pointer",
  userSelect: "none",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TimesheetClient({
  clients, members, hoursTarget,
}: { clients: Client[]; members: Member[]; hoursTarget: number }) {
  const router = useRouter();

  // View
  const [view, setView] = useState<"table" | "dashboard">("table");

  // Data
  const [entries,      setEntries]      = useState<Entry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editEntry,    setEditEntry]    = useState<Entry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Filters
  const now = new Date();
  const [startDate,     setStartDate]     = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [endDate,       setEndDate]       = useState(format(endOfMonth(now),   "yyyy-MM-dd"));
  const [clientFilter,  setClientFilter]  = useState("");
  const [billingFilter, setBillingFilter] = useState<BillingType | "">("");
  const [memberFilter,  setMemberFilter]  = useState("");

  // Group 6: Search
  const [search, setSearch] = useState("");

  // Group 4: Bulk delete
  const [selectedIds,          setSelectedIds]          = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm,setShowBulkDeleteConfirm]= useState(false);

  // Import dialog
  const [showImport, setShowImport] = useState(false);

  // Group 5: Sorting
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("desc");

  // Group 8: Row expand
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Group 9: Duplicate entry
  const [duplicateEntry, setDuplicateEntry] = useState<Entry | null>(null);

  // Group 21: Scroll to new entry highlight
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // ── Computed ────────────────────────────────────────────────────────────────

  const today          = format(now, "yyyy-MM-dd");
  const showTodayButton = today < startDate || today > endDate;

  function onJumpToToday() {
    const d = new Date();
    setStartDate(format(startOfMonth(d), "yyyy-MM-dd"));
    setEndDate(format(endOfMonth(d),   "yyyy-MM-dd"));
  }

  const existingKeys = useMemo(() =>
    new Set(entries.map(e =>
      `${toDateKey(e.date)}|${(e.project?.name ?? "").toLowerCase()}|${e.taskDescription.toLowerCase()}`
    )),
    [entries]
  );

  // Filtered entries (Group 6)
  const displayEntries = useMemo(() => {
    if (search.length < 2) return entries;
    const q = search.toLowerCase();
    return entries.filter(e =>
      e.taskDescription.toLowerCase().includes(q) ||
      (e.project?.name.toLowerCase().includes(q) ?? false)
    );
  }, [entries, search]);

  // Group by date + sort within groups (Group 5)
  const grouped = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    for (const e of displayEntries) {
      const key = toDateKey(e.date);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }

    if (sortField === "project") {
      for (const key in map) {
        map[key].sort((a, b) => {
          const pa = a.project?.name ?? "";
          const pb = b.project?.name ?? "";
          return sortDir === "asc" ? pa.localeCompare(pb) : pb.localeCompare(pa);
        });
      }
    } else if (sortField === "hours") {
      for (const key in map) {
        map[key].sort((a, b) => {
          const cmp = entryHoursTotal(a) - entryHoursTotal(b);
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
    }

    return map;
  }, [displayEntries, sortField, sortDir]);

  const sortedDates = useMemo(() => {
    const keys = Object.keys(grouped);
    if (sortField === "date") {
      return keys.sort((a, b) => sortDir === "asc" ? (a < b ? -1 : 1) : (a < b ? 1 : -1));
    }
    return keys.sort((a, b) => (a < b ? 1 : -1)); // default: date desc
  }, [grouped, sortField, sortDir]);

  // Select all
  const allVisibleIds = useMemo(() => displayEntries.map(e => e.id), [displayEntries]);
  const isAllSelected  = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id));
  const isIndeterminate = !isAllSelected && allVisibleIds.some(id => selectedIds.has(id));
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = isIndeterminate;
  }, [isIndeterminate]);

  // Total cols for colSpan
  const TOTAL_COLS = 7 + members.length; // checkbox + date + day + project + task + members + total + actions

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const data = await getEntries({
      startDate, endDate,
      clientId:     clientFilter  || undefined,
      billingType:  billingFilter || undefined,
      teamMemberId: memberFilter  || undefined,
    });
    setEntries(data as unknown as Entry[]);
    setLoading(false);
  }, [startDate, endDate, clientFilter, billingFilter, memberFilter]);

  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => { setSelectedIds(new Set()); setExpandedId(null); }, [entries]);

  // Read pending highlight from localStorage (set by EntryForm after create)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = localStorage.getItem("chronicle_new_entry");
    if (id) { localStorage.removeItem("chronicle_new_entry"); setHighlightId(id); }
  }, []);

  // Scroll to and flash the highlighted row once entries are loaded
  useEffect(() => {
    if (!highlightId || loading) return;
    const exists = entries.some(e => e.id === highlightId);
    if (!exists) return;
    const t1 = setTimeout(() => {
      const el = document.getElementById(`entry-row-${highlightId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    const t2 = setTimeout(() => setHighlightId(null), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [highlightId, loading, entries]);

  // ── Event handlers ───────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    await softDeleteEntry(id);
    setDeleteTarget(null);
    toast("Entry moved to trash.", {
      action: {
        label: "Undo",
        onClick: async () => { await bulkRestore([id]); await loadEntries(); },
      },
    });
    await loadEntries();
  }

  async function handleBulkDelete() {
    const ids   = Array.from(selectedIds);
    const count = ids.length;
    await bulkSoftDelete(ids);
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
    toast(`${count} ${count === 1 ? "entry" : "entries"} moved to trash.`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: async () => { await bulkRestore(ids); await loadEntries(); },
      },
    });
    await loadEntries();
  }

  function toggleRow(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(isAllSelected ? new Set() : new Set(allVisibleIds));
  }

  function handleSortClick(field: "date" | "project" | "hours") {
    if (sortField !== field) { setSortField(field); setSortDir("asc"); }
    else if (sortDir === "asc") { setSortDir("desc"); }
    else { setSortField(null); setSortDir("desc"); }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <PageMotion>
      <TopBar
        view={view}
        onViewChange={setView}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        clients={clients.map(c => ({ id: c.id, name: c.name }))}
        clientFilter={clientFilter}
        onClientFilterChange={setClientFilter}
        billingFilter={billingFilter as "RETAINERSHIP" | "OUT_OF_RETAINERSHIP" | "INTERNAL" | ""}
        onBillingFilterChange={v => setBillingFilter(v as BillingType | "")}
        members={members.map(m => ({ id: m.id, name: m.name }))}
        memberFilter={memberFilter}
        onMemberFilterChange={setMemberFilter}
        onNewEntry={() => router.push("/timesheet/new")}
        onImport={() => setShowImport(true)}
        search={search}
        onSearchChange={setSearch}
        showTodayButton={showTodayButton}
        onJumpToToday={onJumpToToday}
      />

      <div style={{ padding: "0 48px 48px" }}>
        {view === "dashboard" ? (
          <DashboardView
            entries={entries as never}
            members={members}
            clients={clients as never}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            hoursTarget={hoursTarget}
            onJumpToDate={(day) => { setView("table"); setStartDate(day); setEndDate(day); }}
          />
        ) : loading ? (
          <table className="w-full" style={{ minWidth: 700 }}>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={members.length} />
              ))}
            </tbody>
          </table>
        ) : entries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center"
            style={{ minHeight: "calc(100vh - 200px)" }}
          >
            <p className="font-fraunces" style={{ fontVariationSettings: "'opsz' 48", fontSize: 28, color: "var(--text-muted)", lineHeight: "36px" }}>
              No entries yet.
            </p>
            <p style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 14, color: "var(--text-muted)", marginTop: 8 }}>
              Add your first task to begin the record.
            </p>
            <motion.button
              onClick={() => router.push("/timesheet/new")}
              className="flex items-center gap-1.5 mt-8"
              style={{ background: "var(--text-primary)", color: "var(--bg-ground)", border: "none", borderRadius: 4, height: 36, padding: "0 14px", fontSize: 13, fontFamily: "var(--font-instrument-sans)", fontWeight: 500, cursor: "pointer" }}
              whileTap={{ scale: 0.97 }}
            >
              <Plus size={14} strokeWidth={1.5} />
              New Entry
            </motion.button>
          </motion.div>
        ) : (
          <>
            {/* ── Group 4: Contextual action bar ─────────────────────────── */}
            <AnimatePresence>
              {selectedIds.size > 0 && (
                <motion.div
                  key="action-bar"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  style={{
                    display:      "flex",
                    alignItems:   "center",
                    gap:          12,
                    background:   "var(--bg-surface)",
                    border:       "1px solid var(--border-subtle)",
                    borderRadius: 10,
                    padding:      "10px 16px",
                    marginBottom: 12,
                    boxShadow:    "var(--shadow-sm)",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-martian-mono)", fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                    {selectedIds.size} {selectedIds.size === 1 ? "entry" : "entries"} selected
                  </span>
                  <div style={{ flex: 1 }} />
                  <motion.button
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      height: 32, padding: "0 14px",
                      background: "color-mix(in srgb, var(--color-destructive) 10%, transparent)",
                      color: "var(--color-destructive)",
                      border: "1px solid color-mix(in srgb, var(--color-destructive) 25%, transparent)",
                      borderRadius: 8,
                      fontFamily: "var(--font-instrument-sans)", fontSize: 13, fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                    Move to Trash
                  </motion.button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 13, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Table ──────────────────────────────────────────────────── */}
            <div
              className="overflow-hidden"
              style={{ background: "var(--bg-surface)", borderRadius: 12, border: "1px solid var(--border-ghost)", boxShadow: "var(--shadow-sm)" }}
              aria-busy={loading}
            >
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-ground)", borderBottom: "2px solid var(--border-subtle)", position: "sticky", top: 60, zIndex: 10 }}>
                      {/* Checkbox column */}
                      <th scope="col" style={{ width: 44, padding: "0 8px", textAlign: "center" }}>
                        <input
                          ref={headerCheckboxRef}
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={toggleAll}
                          style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--bg-ink)", borderRadius: 3 }}
                        />
                      </th>
                      {/* Date — sortable */}
                      <th
                        scope="col"
                        onClick={() => handleSortClick("date")}
                        style={{ ...thSortStyle, width: 96, textAlign: "left" }}
                      >
                        Date <SortIcon field="date" sortField={sortField} sortDir={sortDir} />
                      </th>
                      {/* Day */}
                      <th scope="col" style={{ ...thStyle, width: 52, textAlign: "left" }}>Day</th>
                      {/* Project — sortable */}
                      <th
                        scope="col"
                        onClick={() => handleSortClick("project")}
                        style={{ ...thSortStyle, width: 160, textAlign: "left" }}
                      >
                        Project <SortIcon field="project" sortField={sortField} sortDir={sortDir} />
                      </th>
                      {/* Task */}
                      <th scope="col" style={{ ...thStyle, textAlign: "left" }}>Task</th>
                      {/* Member hours */}
                      {members.map(m => (
                        <th key={m.id} scope="col" style={{ ...thStyle, width: 52, textAlign: "right" }}>
                          {m.initials}
                        </th>
                      ))}
                      {/* Total — sortable */}
                      <th
                        scope="col"
                        onClick={() => handleSortClick("hours")}
                        style={{ ...thSortStyle, width: 68, textAlign: "right" }}
                      >
                        Total <SortIcon field="hours" sortField={sortField} sortDir={sortDir} />
                      </th>
                      {/* Actions */}
                      <th scope="col" style={{ width: 52 }} />
                    </tr>
                  </thead>

                  <tbody>
                    {sortedDates.map(dateKey => {
                      const dayEntries = grouped[dateKey];

                      const dayTotal = dayEntries.reduce((sum, e) => {
                        if (e.isMeeting) return sum + (e.meetingDuration ?? 0);
                        return sum + e.taskHours.reduce((s, th) => s + th.hours, 0);
                      }, 0);

                      const memberDayTotals = members.reduce((acc, m) => {
                        acc[m.id] = dayEntries.reduce((sum, e) => {
                          const th = e.taskHours.find(h => h.teamMemberId === m.id);
                          return sum + (th?.hours ?? 0);
                        }, 0);
                        return acc;
                      }, {} as Record<string, number>);

                      return (
                        <Fragment key={dateKey}>
                          {dayEntries.map((entry, entryIdx) => {
                            const clientName  = entry.project?.client?.name ?? "Goku Studio";
                            const entryTotal  = entryHoursTotal(entry);
                            const isExpanded  = expandedId === entry.id;
                            const isSelected  = selectedIds.has(entry.id);

                            return (
                              <Fragment key={entry.id}>
                                <TableRow
                                  entry={entry}
                                  entryIdx={entryIdx}
                                  clientName={clientName}
                                  entryTotal={entryTotal}
                                  members={members}
                                  isSelected={isSelected}
                                  anySelected={selectedIds.size > 0}
                                  isExpanded={isExpanded}
                                  isHighlighted={highlightId === entry.id}
                                  onToggleSelect={(e) => { e.stopPropagation(); toggleRow(entry.id); }}
                                  onToggleExpand={() => setExpandedId(isExpanded ? null : entry.id)}
                                  onEdit={() => setEditEntry(entry)}
                                  onDelete={() => setDeleteTarget(entry.id)}
                                  onDuplicate={() => { setExpandedId(null); setDuplicateEntry(entry); }}
                                />

                                {/* Expanded row (Group 8) */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <tr key="expanded" style={{ background: "var(--bg-ground)" }}>
                                      <td colSpan={TOTAL_COLS} style={{ padding: 0 }}>
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: "auto", opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                                          style={{ overflow: "hidden" }}
                                        >
                                          <ExpandedRowContent
                                            entry={entry}
                                            members={members}
                                            onEdit={() => { setExpandedId(null); setEditEntry(entry); }}
                                            onDelete={() => { setExpandedId(null); setDeleteTarget(entry.id); }}
                                            onDuplicate={() => { setExpandedId(null); setDuplicateEntry(entry); }}
                                          />
                                        </motion.div>
                                      </td>
                                    </tr>
                                  )}
                                </AnimatePresence>
                              </Fragment>
                            );
                          })}

                          {/* Day total row */}
                          <tr style={{ borderTop: "2px solid var(--border-subtle)", background: "var(--bg-ground)" }}>
                            <td style={{ height: 36 }} /> {/* checkbox col */}
                            <td style={{ height: 36 }} />
                            <td style={{ height: 36 }} />
                            <td
                              colSpan={2}
                              style={{ padding: "0 16px", height: 36, fontFamily: "var(--font-martian-mono)", fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)" }}
                            >
                              Total
                            </td>
                            {members.map(m => (
                              <td key={m.id} style={{ padding: "0 16px", height: 36, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                {memberDayTotals[m.id] > 0 ? <HoursCell hours={memberDayTotals[m.id]} /> : null}
                              </td>
                            ))}
                            <td style={{ padding: "0 16px", height: 36, textAlign: "right", fontFamily: "var(--font-martian-mono)", fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                              <HoursCell hours={dayTotal} />
                            </td>
                            <td />
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Import dialog (Group 2 connected) */}
      <ImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={loadEntries}
        existingKeys={existingKeys}
      />

      {/* Duplicate entry sheet (Group 9) */}
      {duplicateEntry && (
        <DuplicateEntrySheet
          entry={duplicateEntry}
          clients={clients}
          members={members}
          onClose={() => setDuplicateEntry(null)}
          onSaved={async () => { setDuplicateEntry(null); await loadEntries(); }}
        />
      )}

      {/* Edit modal */}
      {editEntry && (
        <EditEntryModal
          entry={editEntry}
          clients={clients}
          members={members}
          onClose={() => setEditEntry(null)}
          onSaved={async () => { setEditEntry(null); await loadEntries(); }}
        />
      )}

      {/* Single-entry delete confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(42, 31, 20, 0.15)" }}
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="p-6 max-w-xs w-full mx-4"
              style={{ background: "var(--bg-overlay)", border: "1px solid var(--border-subtle)", borderRadius: 4 }}
              onClick={e => e.stopPropagation()}
            >
              <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>
                Move to Trash
              </p>
              <p style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
                This entry can be restored from Trash later.
              </p>
              <div className="flex gap-2">
                <motion.button onClick={() => handleDelete(deleteTarget!)} className="flex-1" whileTap={{ scale: 0.97 }}
                  style={{ background: "var(--color-destructive)", color: "var(--bg-overlay)", borderRadius: 4, border: "none", height: 36, fontSize: 13, fontFamily: "var(--font-instrument-sans)", cursor: "pointer" }}>
                  Move to Trash
                </motion.button>
                <motion.button onClick={() => setDeleteTarget(null)} className="flex-1" whileTap={{ scale: 0.97 }}
                  style={{ background: "var(--bg-hover)", color: "var(--text-primary)", borderRadius: 4, border: "1px solid var(--border-medium)", height: 36, fontSize: 13, fontFamily: "var(--font-instrument-sans)", cursor: "pointer" }}>
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk delete confirm (Group 4) */}
      <AnimatePresence>
        {showBulkDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(42, 31, 20, 0.15)" }}
            onClick={() => setShowBulkDeleteConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="p-6 max-w-sm w-full mx-4"
              style={{ background: "var(--bg-overlay)", border: "1px solid var(--border-subtle)", borderRadius: 4 }}
              onClick={e => e.stopPropagation()}
            >
              <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>
                Confirm Delete
              </p>
              <p style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
                Move {selectedIds.size} {selectedIds.size === 1 ? "entry" : "entries"} to trash? They can be restored later.
              </p>
              <div className="flex gap-2">
                <motion.button onClick={handleBulkDelete} className="flex-1" whileTap={{ scale: 0.97 }}
                  style={{ background: "var(--color-destructive)", color: "var(--bg-overlay)", borderRadius: 4, border: "none", height: 36, fontSize: 13, fontFamily: "var(--font-instrument-sans)", cursor: "pointer" }}>
                  Move to Trash
                </motion.button>
                <motion.button onClick={() => setShowBulkDeleteConfirm(false)} className="flex-1" whileTap={{ scale: 0.97 }}
                  style={{ background: "var(--bg-hover)", color: "var(--text-primary)", borderRadius: 4, border: "1px solid var(--border-medium)", height: 36, fontSize: 13, fontFamily: "var(--font-instrument-sans)", cursor: "pointer" }}>
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageMotion>
  );
}

// ─── TableRow ─────────────────────────────────────────────────────────────────

function TableRow({
  entry, entryIdx,
  clientName, entryTotal, members,
  isSelected, anySelected, isExpanded, isHighlighted,
  onToggleSelect, onToggleExpand, onEdit, onDelete, onDuplicate,
}: {
  entry: Entry; entryIdx: number;
  clientName: string; entryTotal: number; members: Member[];
  isSelected: boolean; anySelected: boolean; isExpanded: boolean; isHighlighted: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showCheck = hovered || anySelected;

  const d = new Date(entry.date);
  const dateDisplay = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const dayDisplay  = d.toLocaleDateString("en-GB", { weekday: "short" });

  return (
    <motion.tr
      id={`entry-row-${entry.id}`}
      data-highlight={isHighlighted ? "true" : undefined}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: entryIdx * 0.02, duration: 0.2, ease: [0, 0, 0.2, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggleExpand}
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        background:   isSelected
          ? "color-mix(in srgb, var(--bg-ink) 6%, transparent)"
          : isExpanded
            ? "var(--bg-hover)"
            : hovered ? "var(--bg-hover)" : "transparent",
        cursor:     "pointer",
        transition: "background 150ms var(--ease-enter)",
        boxShadow:  hovered || isExpanded ? "inset 3px 0 0 var(--border-strong)" : "none",
      }}
    >
      {/* Checkbox */}
      <td
        style={{ padding: "0 8px", height: 56, textAlign: "center" }}
        onClick={onToggleSelect}
      >
        <div style={{ opacity: showCheck ? 1 : 0, transition: "opacity 150ms ease" }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            onClick={onToggleSelect}
            style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--bg-ink)", pointerEvents: "none" }}
          />
        </div>
      </td>

      {/* Date + Day — visible only for the first entry in each date group */}
      <td
        scope="row"
        style={{
          padding: "16px 16px 0", verticalAlign: "top",
          fontFamily: "var(--font-instrument-sans)", fontSize: 15, fontWeight: 600, color: "var(--text-primary)",
          whiteSpace: "nowrap", visibility: entryIdx === 0 ? "visible" : "hidden",
        }}
      >
        {dateDisplay}
      </td>
      <td
        style={{
          padding: "18px 16px 0", verticalAlign: "top",
          fontFamily: "var(--font-martian-mono)", fontSize: 12, color: "var(--text-muted)",
          visibility: entryIdx === 0 ? "visible" : "hidden",
        }}
      >
        {dayDisplay}
      </td>

      {/* Project pill */}
      <td style={{ padding: "0 16px", height: 56 }}>
        <ProjectPillStatic
          projectName={entry.project?.name ?? "Internal"}
          clientName={clientName}
        />
      </td>

      {/* Task description */}
      <td
        style={{ padding: "0 16px", height: 56, fontFamily: "var(--font-instrument-sans)", fontSize: 14, color: "var(--text-primary)" }}
      >
        {entry.taskDescription}
      </td>

      {/* Hours per member */}
      {entry.isMeeting ? (
        <td
          colSpan={members.length}
          style={{ padding: "0 16px", height: 56, textAlign: "center", fontFamily: "var(--font-martian-mono)", fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}
        >
          Meeting · {entry.personCount}p
        </td>
      ) : (
        members.map(m => {
          const th = entry.taskHours.find(h => h.teamMemberId === m.id);
          return (
            <td
              key={m.id}
              style={{ padding: "0 16px", height: 56, textAlign: "right", fontFamily: "var(--font-martian-mono)", fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}
            >
              {th ? <HoursCell hours={th.hours} /> : null}
            </td>
          );
        })
      )}

      {/* Row total */}
      <td style={{ padding: "0 16px", height: 56, textAlign: "right", fontFamily: "var(--font-martian-mono)", fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
        {entryTotal > 0 ? <HoursCell hours={entryTotal} /> : null}
      </td>

      {/* Action icons */}
      <td style={{ padding: "0 8px", height: 56 }}>
        <div
          className="flex items-center justify-end gap-1"
          style={{ opacity: hovered ? 1 : 0, transition: "opacity 150ms var(--ease-standard)" }}
        >
          <ActionIcon aria-label="Duplicate entry" onClick={e => { e.stopPropagation(); onDuplicate(); }} hoverRotate={5}>
            <Copy size={14} strokeWidth={1.5} />
          </ActionIcon>
          <ActionIcon aria-label="Edit entry" onClick={e => { e.stopPropagation(); onEdit(); }} hoverRotate={-10}>
            <Pencil size={14} strokeWidth={1.5} />
          </ActionIcon>
          <ActionIcon aria-label="Delete entry" onClick={e => { e.stopPropagation(); onDelete(); }} hoverColor="var(--color-destructive)" hoverRotate={-5}>
            <Trash2 size={14} strokeWidth={1.5} />
          </ActionIcon>
        </div>
      </td>
    </motion.tr>
  );
}

// ─── Expanded row content (Group 8) ───────────────────────────────────────────

function ExpandedRowContent({
  entry, members, onEdit, onDelete, onDuplicate,
}: {
  entry: Entry; members: Member[];
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void;
}) {
  const billing = effectiveBilling(entry);

  return (
    <div
      style={{
        padding:    "20px 24px 20px 68px", // indent past checkbox + date + day columns
        display:    "flex",
        flexDirection: "column",
        gap:        14,
        borderTop:  "1px solid var(--border-ghost)",
      }}
    >
      {/* Full task description */}
      <p style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>
        {entry.taskDescription}
      </p>

      {/* Member hours chips */}
      {!entry.isMeeting && entry.taskHours.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {entry.taskHours.map(th => {
            const member = members.find(m => m.id === th.teamMemberId);
            if (!member) return null;
            return (
              <div
                key={th.teamMemberId}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "3px 10px 3px 5px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-ghost)",
                  borderRadius: 20,
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: "var(--bg-ink)", color: "var(--text-on-dark)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700, fontFamily: "var(--font-martian-mono)", flexShrink: 0,
                }}>
                  {member.initials}
                </div>
                <span style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 13, color: "var(--text-primary)" }}>
                  {member.name}
                </span>
                <span style={{ fontFamily: "var(--font-martian-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                  {th.hours}h
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Meeting detail */}
      {entry.isMeeting && (
        <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 11, color: "var(--text-muted)" }}>
          Meeting · {entry.personCount} attendees · {entry.meetingDuration}h
        </p>
      )}

      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <BillingBadge type={billing} />
        <span style={{ fontFamily: "var(--font-martian-mono)", fontSize: 10, color: "var(--text-muted)" }}>
          Created {new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          {" · "}
          {new Date(entry.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <motion.button
            onClick={onDuplicate}
            whileTap={{ scale: 0.97 }}
            style={{ height: 30, padding: "0 12px", background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-ghost)", borderRadius: 6, fontFamily: "var(--font-instrument-sans)", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
          >
            <Copy size={11} strokeWidth={1.5} />
            Duplicate
          </motion.button>
          <motion.button
            onClick={onEdit}
            whileTap={{ scale: 0.97 }}
            style={{ height: 30, padding: "0 12px", background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-medium)", borderRadius: 6, fontFamily: "var(--font-instrument-sans)", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
          >
            <Pencil size={11} strokeWidth={1.5} />
            Edit
          </motion.button>
          <motion.button
            onClick={onDelete}
            whileTap={{ scale: 0.97 }}
            style={{ height: 30, padding: "0 12px", background: "color-mix(in srgb, var(--color-destructive) 8%, transparent)", color: "var(--color-destructive)", border: "1px solid color-mix(in srgb, var(--color-destructive) 20%, transparent)", borderRadius: 6, fontFamily: "var(--font-instrument-sans)", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
          >
            <Trash2 size={11} strokeWidth={1.5} />
            Delete
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── ActionIcon ───────────────────────────────────────────────────────────────

function ActionIcon({
  children, onClick, hoverColor, hoverRotate, "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  hoverColor?: string;
  hoverRotate?: number;
  "aria-label": string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      aria-label={ariaLabel}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{
        scale:  hovered ? 1.12 : 1,
        rotate: hovered ? (hoverRotate ?? 0) : 0,
        color:  hovered && hoverColor ? hoverColor : "var(--text-muted)",
      }}
      transition={{ duration: 0.15 }}
      style={{ padding: 6, borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", color: "var(--text-muted)" }}
    >
      {children}
    </motion.button>
  );
}
