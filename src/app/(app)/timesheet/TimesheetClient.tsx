"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { BillingType } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getEntries, softDeleteEntry } from "@/app/actions/entries";
import DashboardView from "./DashboardView";
import EditEntryModal from "./EditEntryModal";
import PageMotion from "@/components/PageMotion";
import { TopBar } from "@/components/TopBar";
import { ProjectPillStatic } from "@/components/chronicle/ProjectPill";

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
};

// Timezone-safe date string from a Date or ISO string
function toDateKey(d: Date | string): string {
  const s = typeof d === "string" ? d : d.toISOString();
  return s.substring(0, 10); // "yyyy-MM-dd"
}


function HoursCell({ hours }: { hours: number }) {
  if (!hours || hours <= 0) {
    return <span style={{ fontFamily: "var(--font-martian-mono)", opacity: 0.35 }}>—</span>;
  }
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

export default function TimesheetClient({
  clients, members,
}: { clients: Client[]; members: Member[] }) {
  const router  = useRouter();
  const [view, setView] = useState<"table" | "dashboard">("table");
  const [entries,     setEntries]     = useState<Entry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [editEntry,   setEditEntry]   = useState<Entry | null>(null);
  const [deleteTarget,setDeleteTarget]= useState<string | null>(null);

  const now = new Date();
  const [startDate,     setStartDate]     = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [endDate,       setEndDate]       = useState(format(endOfMonth(now),   "yyyy-MM-dd"));
  const [clientFilter,  setClientFilter]  = useState("");
  const [billingFilter, setBillingFilter] = useState<BillingType | "">("");
  const [memberFilter,  setMemberFilter]  = useState("");

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const data = await getEntries({
      startDate, endDate,
      clientId:    clientFilter  || undefined,
      billingType: billingFilter || undefined,
      teamMemberId:memberFilter  || undefined,
    });
    setEntries(data as unknown as Entry[]);
    setLoading(false);
  }, [startDate, endDate, clientFilter, billingFilter, memberFilter]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  async function handleDelete(id: string) {
    await softDeleteEntry(id);
    setDeleteTarget(null);
    toast("Entry deleted.", {
      action: { label: "Undo", onClick: () => loadEntries() },
    });
    await loadEntries();
  }

  // Group entries by date key (timezone-safe)
  const grouped = entries.reduce((acc, entry) => {
    const key = toDateKey(entry.date);
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {} as Record<string, Entry[]>);
  const sortedDates = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  return (
    <PageMotion>
      <TopBar
        view={view}
        onViewChange={setView}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        clientFilter={clientFilter}
        onClientFilterChange={setClientFilter}
        billingFilter={billingFilter as "RETAINERSHIP" | "OUT_OF_RETAINERSHIP" | "INTERNAL" | ""}
        onBillingFilterChange={(v) => setBillingFilter(v as BillingType | "")}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        memberFilter={memberFilter}
        onMemberFilterChange={setMemberFilter}
        onNewEntry={() => router.push("/timesheet/new")}
      />

      <div style={{ padding: "0 48px 48px" }}>
        {view === "dashboard" ? (
          <DashboardView entries={entries as never} members={members} clients={clients as never} />
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center"
            style={{ minHeight: "calc(100vh - 200px)" }}
          >
            <p
              className="font-fraunces"
              style={{
                fontVariationSettings: "'opsz' 48",
                fontSize:              28,
                color:                 "var(--text-muted)",
                lineHeight:            "36px",
              }}
            >
              No entries yet.
            </p>
            <p
              style={{
                fontFamily: "var(--font-instrument-sans)",
                fontSize:   14,
                color:      "var(--text-muted)",
                marginTop:  8,
              }}
            >
              Add your first task to begin the record.
            </p>
            <motion.button
              onClick={() => router.push("/timesheet/new")}
              className="flex items-center gap-1.5 mt-8"
              style={{
                background:  "var(--text-primary)",
                color:       "var(--bg-ground)",
                border:      "none",
                borderRadius:4,
                height:      36,
                padding:     "0 14px",
                fontSize:    13,
                fontFamily:  "var(--font-instrument-sans)",
                fontWeight:  500,
                cursor:      "pointer",
              }}
              whileTap={{ scale: 0.97 }}
            >
              <Plus size={14} strokeWidth={1.5} />
              New Entry
            </motion.button>
          </motion.div>
        ) : (
          <div
            className="overflow-hidden"
            style={{
              background:   "var(--bg-surface)",
              borderRadius: 12,
              border:       "1px solid var(--border-ghost)",
              boxShadow:    "var(--shadow-sm)",
            }}
            aria-busy={loading}
          >
            <div className="overflow-x-auto">
            <table
              className="w-full"
              style={{ borderCollapse: "collapse" }}
            >
              <thead>
                <tr
                  style={{
                    background:   "var(--bg-ground)",
                    borderBottom: "2px solid var(--border-subtle)",
                    position:     "sticky",
                    top:          60,
                    zIndex:       10,
                  }}
                >
                  {/* Date */}
                  <th scope="col" style={{ ...thStyle, width: 96, textAlign: "left" }}>Date</th>
                  {/* Day */}
                  <th scope="col" style={{ ...thStyle, width: 52, textAlign: "left" }}>Day</th>
                  {/* Project */}
                  <th scope="col" style={{ ...thStyle, width: 160, textAlign: "left" }}>Project</th>
                  {/* Task — takes remaining space */}
                  <th scope="col" style={{ ...thStyle, textAlign: "left" }}>Task</th>
                  {/* Member hours */}
                  {members.map((m) => (
                    <th key={m.id} scope="col" style={{ ...thStyle, width: 52, textAlign: "right" }}>
                      {m.initials}
                    </th>
                  ))}
                  {/* Total */}
                  <th scope="col" style={{ ...thStyle, width: 68, textAlign: "right" }}>Total</th>
                  {/* Actions */}
                  <th scope="col" style={{ width: 52 }} />
                </tr>
              </thead>

              <tbody>
                {sortedDates.map((dateKey) => {
                  const dayEntries = grouped[dateKey];

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

                  return (
                    <Fragment key={dateKey}>
                      {dayEntries.map((entry, entryIdx) => {
                        const clientName = entry.project?.client?.name ?? "Goku Studio";
                        const entryTotal = entry.isMeeting
                          ? (entry.meetingDuration ?? 0)
                          : entry.taskHours.reduce((s, th) => s + th.hours, 0);

                        return (
                          <TableRow
                            key={entry.id}
                            entry={entry}
                            entryIdx={entryIdx}
                            groupSize={dayEntries.length}
                            clientName={clientName}
                            entryTotal={entryTotal}
                            members={members}
                            onEdit={() => setEditEntry(entry)}
                            onDelete={() => setDeleteTarget(entry.id)}
                          />
                        );
                      })}

                      {/* ── Day total row ───────────────────────────── */}
                      <tr style={{ borderTop: "2px solid var(--border-subtle)", background: "var(--bg-ground)" }}>
                        <td style={{ height: 36 }} />
                        <td style={{ height: 36 }} />
                        <td
                          colSpan={2}
                          style={{
                            padding:       "0 16px",
                            height:        36,
                            fontFamily:    "var(--font-martian-mono)",
                            fontSize:      10,
                            letterSpacing: "0.10em",
                            textTransform: "uppercase",
                            color:         "var(--text-muted)",
                          }}
                        >
                          Total
                        </td>
                        {members.map((m) => (
                          <td
                            key={m.id}
                            style={{
                              padding:           "0 16px",
                              height:            36,
                              textAlign:         "right",
                              fontVariantNumeric:"tabular-nums",
                            }}
                          >
                            {memberDayTotals[m.id] > 0
                              ? <HoursCell hours={memberDayTotals[m.id]} />
                              : null}
                          </td>
                        ))}
                        <td
                          style={{
                            padding:           "0 16px",
                            height:            36,
                            textAlign:         "right",
                            fontFamily:        "var(--font-martian-mono)",
                            fontSize:          14,
                            fontWeight:        600,
                            color:             "var(--text-primary)",
                            fontVariantNumeric:"tabular-nums",
                          }}
                        >
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
        )}
      </div>

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

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(42, 31, 20, 0.15)" }}
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="p-6 max-w-xs w-full mx-4"
              style={{
                background:   "var(--bg-overlay)",
                border:       "1px solid var(--border-subtle)",
                borderRadius: 4,
              }}
              onClick={(e) => e.stopPropagation()}
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
    </PageMotion>
  );
}

// ─── Shared th style ──────────────────────────────────────────────────────────

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

// ─── TableRow ────────────────────────────────────────────────────────────────

function TableRow({
  entry, entryIdx, groupSize,
  clientName, entryTotal, members, onEdit, onDelete,
}: {
  entry: Entry; entryIdx: number; groupSize: number;
  clientName: string; entryTotal: number; members: Member[];
  onEdit: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const d = new Date(entry.date);
  const dateDisplay = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const dayDisplay  = d.toLocaleDateString("en-GB", { weekday: "short" });

  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: entryIdx * 0.02, duration: 0.2, ease: [0, 0, 0.2, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEdit}
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        background:   hovered ? "var(--bg-hover)" : "transparent",
        cursor:       "pointer",
        transition:   "background 150ms var(--ease-enter)",
        boxShadow:    hovered ? "inset 3px 0 0 var(--border-strong)" : "none",
      }}
    >
      {/* Date + Day — visible only for the first entry in each date group */}
      <td
        scope="row"
        style={{
          padding:      "16px 16px 0",
          verticalAlign:"top",
          fontFamily:   "var(--font-instrument-sans)",
          fontSize:     15,
          fontWeight:   600,
          color:        "var(--text-primary)",
          whiteSpace:   "nowrap",
          visibility:   entryIdx === 0 ? "visible" : "hidden",
        }}
      >
        {dateDisplay}
      </td>
      <td
        style={{
          padding:      "18px 16px 0",
          verticalAlign:"top",
          fontFamily:   "var(--font-martian-mono)",
          fontSize:     12,
          color:        "var(--text-muted)",
          visibility:   entryIdx === 0 ? "visible" : "hidden",
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

      {/* Task description — full text, no truncation */}
      <td
        style={{
          padding:    "0 16px",
          height:     56,
          fontFamily: "var(--font-instrument-sans)",
          fontSize:   14,
          color:      "var(--text-primary)",
        }}
      >
        {entry.taskDescription}
      </td>

      {/* Hours per member */}
      {entry.isMeeting ? (
        <td
          colSpan={members.length}
          style={{
            padding:    "0 16px",
            height:     56,
            textAlign:  "center",
            fontFamily: "var(--font-martian-mono)",
            fontSize:   11,
            color:      "var(--text-muted)",
            fontStyle:  "italic",
          }}
        >
          Meeting · {entry.personCount}p
        </td>
      ) : (
        members.map((m) => {
          const th = entry.taskHours.find((h) => h.teamMemberId === m.id);
          return (
            <td
              key={m.id}
              style={{
                padding:           "0 16px",
                height:            56,
                textAlign:         "right",
                fontFamily:        "var(--font-martian-mono)",
                fontSize:          14,
                fontWeight:        500,
                color:             "var(--text-secondary)",
                fontVariantNumeric:"tabular-nums",
              }}
            >
              {th ? <HoursCell hours={th.hours} /> : null}
            </td>
          );
        })
      )}

      {/* Row total */}
      <td
        style={{
          padding:           "0 16px",
          height:            56,
          textAlign:         "right",
          fontFamily:        "var(--font-martian-mono)",
          fontSize:          14,
          fontWeight:        600,
          color:             "var(--text-primary)",
          fontVariantNumeric:"tabular-nums",
        }}
      >
        {entryTotal > 0 ? <HoursCell hours={entryTotal} /> : null}
      </td>

      {/* Action icons */}
      <td style={{ padding: "0 8px", height: 56 }}>
        <div
          className="flex items-center justify-end gap-1"
          style={{
            opacity:    hovered ? 1 : 0,
            transition: "opacity 150ms var(--ease-standard)",
          }}
        >
          <ActionIcon
            aria-label="Edit entry"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            hoverRotate={-10}
          >
            <Pencil size={14} strokeWidth={1.5} />
          </ActionIcon>
          <ActionIcon
            aria-label="Delete entry"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            hoverColor="var(--color-destructive)"
            hoverRotate={-5}
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </ActionIcon>
        </div>
      </td>
    </motion.tr>
  );
}

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
      style={{
        padding:      6,
        borderRadius: 4,
        border:       "none",
        background:   "transparent",
        cursor:       "pointer",
        display:      "flex",
        alignItems:   "center",
        color:        "var(--text-muted)",
      }}
    >
      {children}
    </motion.button>
  );
}
