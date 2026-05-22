"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { BillingType } from "@prisma/client";
import { Download } from "lucide-react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import SectionLabel from "@/components/SectionLabel";
import { getEntries } from "@/app/actions/entries";

type Member = { id: string; name: string; initials: string; isActive: boolean };
type Project = { id: string; name: string; billingType: BillingType; clientId: string };
type Client = {
  id: string;
  name: string;
  hasRetainership: boolean;
  projects: Project[];
  createdAt: Date;
};
type TaskHour = { teamMemberId: string; hours: number };
type Entry = {
  id: string;
  date: Date;
  project: (Project & { client: Client }) | null;
  taskDescription: string;
  isMeeting: boolean;
  personCount: number | null;
  meetingDuration: number | null;
  billingOverride: BillingType | null;
  taskHours: TaskHour[];
};

function entryHours(entry: Entry): number {
  if (entry.isMeeting) return entry.meetingDuration ?? 0;
  return entry.taskHours.reduce((s, th) => s + th.hours, 0);
}

const inputLineStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--border)",
  outline: "none",
  padding: "8px 0",
  fontSize: 14,
  color: "var(--text-primary)",
  fontFamily: "var(--font-geist-sans, sans-serif)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-geist-mono, monospace)",
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 6,
};

export default function ExportClient({
  clients,
  members,
}: {
  clients: Client[];
  members: Member[];
}) {
  const now = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(now), "yyyy-MM-dd"));
  const [clientFilter, setClientFilter] = useState("");
  const [billingFilter, setBillingFilter] = useState<BillingType | "">("");
  const [anonymous, setAnonymous] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const data = await getEntries({
      startDate,
      endDate,
      clientId: clientFilter || undefined,
      billingType: billingFilter || undefined,
    });
    setEntries(data as unknown as Entry[]);
    setLoading(false);
  }, [startDate, endDate, clientFilter, billingFilter]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const grouped = entries.reduce(
    (acc, e) => {
      const key = format(new Date(e.date), "yyyy-MM-dd");
      if (!acc[key]) acc[key] = [];
      acc[key].push(e);
      return acc;
    },
    {} as Record<string, Entry[]>
  );
  const sortedDates = Object.keys(grouped).sort();
  const grandTotal = entries.reduce((s, e) => s + entryHours(e), 0);

  async function handleExportJson() {
    setExportingJson(true);
    try {
      const response = await fetch("/api/export-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, clientId: clientFilter || null, billingType: billingFilter || null }),
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chronicle_${startDate}_${endDate}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("JSON export failed. Please try again.");
    } finally {
      setExportingJson(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          clientId: clientFilter || null,
          billingType: billingFilter || null,
          anonymous,
        }),
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timesheet_${startDate}_${endDate}${anonymous ? "_client" : ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Filter panel */}
      <section>
        <SectionLabel>Export Options</SectionLabel>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "24px",
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div>
              <label style={labelStyle}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputLineStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputLineStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Client</label>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                style={inputLineStyle}
              >
                <option value="">All Clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Billing Type</label>
              <select
                value={billingFilter}
                onChange={(e) => setBillingFilter(e.target.value as BillingType | "")}
                style={inputLineStyle}
              >
                <option value="">All Types</option>
                <option value="RETAINERSHIP">Retainership</option>
                <option value="OUT_OF_RETAINERSHIP">Out of Retainership</option>
                <option value="INTERNAL">Internal</option>
              </select>
            </div>
          </div>

          {/* Anonymous toggle + download */}
          <div
            style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <Switch
                id="anonymous"
                checked={anonymous}
                onCheckedChange={setAnonymous}
              />
              <div>
                <label
                  htmlFor="anonymous"
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer" }}
                >
                  Anonymous mode
                </label>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                  Hides team member names — use for client-facing reports
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <motion.button
                onClick={handleExport}
                disabled={exporting || loading || entries.length === 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 24px",
                  background: "var(--action-primary)",
                  color: "var(--action-primary-text)",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: exporting || loading || entries.length === 0 ? "not-allowed" : "pointer",
                  opacity: exporting || loading || entries.length === 0 ? 0.5 : 1,
                  fontFamily: "var(--font-geist-sans, sans-serif)",
                  whiteSpace: "nowrap",
                }}
              >
                <Download size={14} />
                {exporting ? "Generating..." : `Download Excel${entries.length > 0 ? ` (${grandTotal}h)` : ""}`}
              </motion.button>
              <motion.button
                onClick={handleExportJson}
                disabled={exportingJson || loading || entries.length === 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  background: "var(--bg-ground)",
                  color: "var(--text-primary)",
                  border: "1.5px solid var(--border-medium)",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: exportingJson || loading || entries.length === 0 ? "not-allowed" : "pointer",
                  opacity: exportingJson || loading || entries.length === 0 ? 0.5 : 1,
                  fontFamily: "var(--font-geist-sans, sans-serif)",
                  whiteSpace: "nowrap",
                }}
              >
                <Download size={14} />
                {exportingJson ? "Generating..." : "Download JSON"}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Preview table */}
      <section>
        <SectionLabel>
          Preview
          {!loading && (
            <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 400 }}>
              {" "}— {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </SectionLabel>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.08, ease: "easeOut" }}
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} style={{ height: 36, borderRadius: 6 }} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: 14,
                fontStyle: "italic",
              }}
            >
              No entries for the selected period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Date", "Day", "Project", "Task"].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontFamily: "var(--font-geist-mono, monospace)",
                          fontSize: 10,
                          fontWeight: 500,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          background: "var(--surface)",
                          borderRight: i < 3 ? "1px solid var(--border)" : undefined,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                    {anonymous ? (
                      <>
                        <th style={{ padding: "10px 16px", textAlign: "center", fontFamily: "var(--font-geist-mono, monospace)", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", background: "var(--surface)" }}>Resources</th>
                        <th style={{ padding: "10px 16px", textAlign: "center", fontFamily: "var(--font-geist-mono, monospace)", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", background: "var(--surface)" }}>Hours</th>
                      </>
                    ) : (
                      members.map((m) => (
                        <th
                          key={m.id}
                          style={{
                            padding: "10px 12px",
                            textAlign: "center",
                            fontFamily: "var(--font-geist-mono, monospace)",
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: "0.05em",
                            color: "var(--text-secondary)",
                            background: "var(--surface)",
                          }}
                        >
                          {m.initials}
                        </th>
                      ))
                    )}
                    <th style={{ padding: "10px 16px", textAlign: "right", fontFamily: "var(--font-geist-mono, monospace)", fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", background: "var(--surface)" }}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDates.map((dateKey) => {
                    const dayEntries = grouped[dateKey];
                    const date = new Date(dateKey + "T00:00:00");
                    const dateLabel = format(date, "dd MMM");
                    const dayLabel = format(date, "EEE");
                    const dayTotal = dayEntries.reduce((s, e) => s + entryHours(e), 0);

                    return (
                      <>
                        {dayEntries.map((entry, idx) => {
                          const total = entryHours(entry);
                          let workingHours = "";
                          let resourceCount = 0;

                          if (entry.isMeeting) {
                            resourceCount = entry.personCount ?? 0;
                            workingHours = String(entry.meetingDuration ?? 0);
                          } else {
                            const hoursArr = entry.taskHours.map((th) => th.hours);
                            resourceCount = hoursArr.length;
                            workingHours = hoursArr.length === 1 ? String(hoursArr[0]) : hoursArr.join("+");
                          }

                          return (
                            <tr
                              key={entry.id}
                              style={{ borderBottom: "1px solid var(--border)" }}
                            >
                              {idx === 0 && (
                                <>
                                  <td
                                    rowSpan={dayEntries.length + 1}
                                    style={{
                                      padding: "12px 16px",
                                      fontWeight: 600,
                                      color: "var(--text-primary)",
                                      verticalAlign: "top",
                                      borderRight: "1px solid var(--border)",
                                      whiteSpace: "nowrap",
                                      fontFamily: "var(--font-geist-mono, monospace)",
                                      fontSize: 12,
                                    }}
                                  >
                                    {dateLabel}
                                  </td>
                                  <td
                                    rowSpan={dayEntries.length + 1}
                                    style={{
                                      padding: "12px 16px",
                                      color: "var(--text-muted)",
                                      verticalAlign: "top",
                                      borderRight: "1px solid var(--border)",
                                      fontFamily: "var(--font-geist-mono, monospace)",
                                      fontSize: 11,
                                    }}
                                  >
                                    {dayLabel}
                                  </td>
                                </>
                              )}
                              <td style={{ padding: "10px 16px", borderRight: "1px solid var(--border)" }}>
                                {entry.project ? (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 10px",
                                      borderRadius: 20,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      background: "var(--action-primary)",
                                      color: "var(--action-primary-text)",
                                    }}
                                  >
                                    {entry.project.name}
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 10px",
                                      borderRadius: 20,
                                      fontSize: 11,
                                      fontWeight: 500,
                                      background: "var(--surface)",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    Internal
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "10px 16px", color: "var(--text-secondary)", fontSize: 12, maxWidth: 280 }}>
                                {entry.taskDescription}
                              </td>
                              {anonymous ? (
                                <>
                                  <td style={{ padding: "10px 12px", textAlign: "center", color: "var(--text-primary)", fontFamily: "var(--font-geist-mono, monospace)" }}>{resourceCount}</td>
                                  <td style={{ padding: "10px 12px", textAlign: "center", color: "var(--text-primary)", fontFamily: "var(--font-geist-mono, monospace)" }}>{workingHours}</td>
                                </>
                              ) : (
                                entry.isMeeting ? (
                                  <td
                                    colSpan={members.length}
                                    style={{ padding: "10px 16px", textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", fontSize: 11 }}
                                  >
                                    Meeting — {entry.personCount} persons
                                  </td>
                                ) : (
                                  members.map((m) => {
                                    const th = entry.taskHours.find((h) => h.teamMemberId === m.id);
                                    return (
                                      <td
                                        key={m.id}
                                        style={{
                                          padding: "10px 12px",
                                          textAlign: "center",
                                          color: th ? "var(--text-primary)" : "var(--border)",
                                          fontFamily: "var(--font-geist-mono, monospace)",
                                          fontWeight: th ? 600 : 400,
                                        }}
                                      >
                                        {th ? th.hours : "·"}
                                      </td>
                                    );
                                  })
                                )
                              )}
                              <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-geist-mono, monospace)" }}>
                                {total > 0 ? `${total}h` : ""}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Day total row */}
                        <tr key={`total-${dateKey}`} style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)" }}>
                          <td
                            colSpan={anonymous ? 4 : members.length + 2}
                            style={{
                              padding: "8px 16px",
                              fontFamily: "var(--font-geist-mono, monospace)",
                              fontSize: 10,
                              fontWeight: 500,
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                              color: "var(--text-muted)",
                            }}
                          >
                            Day Total
                          </td>
                          <td
                            style={{
                              padding: "8px 16px",
                              textAlign: "right",
                              fontWeight: 700,
                              color: "var(--text-primary)",
                              fontFamily: "var(--font-geist-mono, monospace)",
                            }}
                          >
                            {dayTotal}h
                          </td>
                        </tr>
                      </>
                    );
                  })}
                  {/* Grand total */}
                  <tr style={{ background: "var(--action-primary)" }}>
                    <td
                      colSpan={anonymous ? 6 : members.length + 4}
                      style={{
                        padding: "12px 16px",
                        fontFamily: "var(--font-geist-mono, monospace)",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--action-primary-text)",
                        opacity: 0.7,
                      }}
                    >
                      Grand Total
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        textAlign: "right",
                        fontWeight: 800,
                        fontSize: 16,
                        color: "var(--action-primary-text)",
                        fontFamily: "var(--font-geist-mono, monospace)",
                      }}
                    >
                      {grandTotal}h
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </section>
    </div>
  );
}
