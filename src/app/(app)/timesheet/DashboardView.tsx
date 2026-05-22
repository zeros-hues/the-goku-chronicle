"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { BillingType } from "@prisma/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { motion } from "framer-motion";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, subMonths, parseISO, addDays,
} from "date-fns";
import { Printer } from "lucide-react";
import SectionLabel from "@/components/SectionLabel";

// ─── Types ────────────────────────────────────────────────────────────────────

type Member   = { id: string; name: string; initials: string; isActive: boolean };
type Project  = { id: string; name: string; billingType: BillingType; clientId: string };
type Client   = { id: string; name: string; hasRetainership: boolean; projects: Project[]; createdAt: Date };
type TaskHour = { teamMemberId: string; hours: number };
type Entry    = {
  id: string; date: Date;
  project: (Project & { client: Client }) | null;
  isMeeting: boolean; personCount: number | null; meetingDuration: number | null;
  billingOverride: BillingType | null; taskHours: TaskHour[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function effectiveBilling(e: Entry): BillingType {
  return e.billingOverride ?? e.project?.billingType ?? BillingType.INTERNAL;
}
function entryHours(e: Entry): number {
  if (e.isMeeting) return e.meetingDuration ?? 0;
  return e.taskHours.reduce((s, th) => s + th.hours, 0);
}
function toDateStr(d: Date | string): string {
  const s = typeof d === "string" ? d : d.toISOString();
  return s.substring(0, 10);
}
function formatDay(d: Date | string): string {
  const date = new Date(toDateStr(d) + "T12:00:00");
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    startRef.current = null;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min((ts - startRef.current) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(e * target * 10) / 10);
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return count;
}

// ─── Date range presets ───────────────────────────────────────────────────────

type Preset = { label: string; getRange: () => { start: string; end: string } };

const PRESETS: Preset[] = [
  {
    label: "Today",
    getRange: () => { const d = format(new Date(), "yyyy-MM-dd"); return { start: d, end: d }; },
  },
  {
    label: "This Week",
    getRange: () => {
      const now = new Date();
      return {
        start: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        end:   format(endOfWeek(now,   { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    },
  },
  {
    label: "This Month",
    getRange: () => ({
      start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
      end:   format(endOfMonth(new Date()),   "yyyy-MM-dd"),
    }),
  },
  {
    label: "Last Month",
    getRange: () => {
      const d = subMonths(new Date(), 1);
      return { start: format(startOfMonth(d), "yyyy-MM-dd"), end: format(endOfMonth(d), "yyyy-MM-dd") };
    },
  },
  {
    label: "This Year",
    getRange: () => ({
      start: format(startOfYear(new Date()), "yyyy-MM-dd"),
      end:   format(endOfYear(new Date()),   "yyyy-MM-dd"),
    }),
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children, index = 0, style }: { children: React.ReactNode; index?: number; style?: React.CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: "easeOut" }}
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-ghost)", borderRadius: 12, boxShadow: "var(--shadow-sm)", padding: 28, cursor: "default", ...style }}
      whileHover={{ boxShadow: "var(--shadow-md)", y: -1 } as never}
    >
      {children}
    </motion.div>
  );
}

function StatCard({ label, value, unit, index }: { label: string; value: number; unit?: string; index: number }) {
  const displayed = useCountUp(value);
  return (
    <Card index={index}>
      <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
        {label}
      </p>
      <p style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontFamily: "var(--font-martian-mono)", fontSize: 32, fontWeight: 400, lineHeight: 1, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
          {displayed}
        </span>
        {unit && <span style={{ fontFamily: "var(--font-martian-mono)", fontSize: 16, fontWeight: 400, color: "var(--text-muted)" }}>{unit}</span>}
      </p>
    </Card>
  );
}

function ChartCard({ title, children, index }: { title: string; children: React.ReactNode; index: number }) {
  return (
    <Card index={index} style={{ padding: 24 }}>
      <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 11, fontWeight: 500, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 16 }}>
        {title}
      </p>
      {children}
    </Card>
  );
}

const WARM_COLORS = ["#2A1F14", "#6B5D4F", "#9C8E80", "#C9BEA8", "#DDD5C4"];

const tooltipStyle = {
  background: "var(--bg-surface)", border: "1px solid var(--border-ghost)", borderRadius: 8,
  boxShadow: "var(--shadow-md)", color: "var(--text-primary)", fontSize: 12, fontFamily: "var(--font-martian-mono)",
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardView({
  entries, members, clients,
  startDate, endDate, onStartDateChange, onEndDateChange,
  hoursTarget, onJumpToDate,
}: {
  entries: Entry[];
  members: Member[];
  clients: Client[];
  startDate: string;
  endDate: string;
  onStartDateChange: (d: string) => void;
  onEndDateChange: (d: string) => void;
  hoursTarget: number;
  onJumpToDate: (day: string) => void;
}) {
  void clients;

  // ── Computed ────────────────────────────────────────────────────────────────

  const totalHours        = useMemo(() => entries.reduce((s, e) => s + entryHours(e), 0), [entries]);
  const retainershipHours = useMemo(() => entries.filter(e => effectiveBilling(e) === BillingType.RETAINERSHIP).reduce((s, e) => s + entryHours(e), 0), [entries]);
  const nonRetainerHours  = useMemo(() => entries.filter(e => effectiveBilling(e) === BillingType.OUT_OF_RETAINERSHIP).reduce((s, e) => s + entryHours(e), 0), [entries]);
  const internalHours     = useMemo(() => entries.filter(e => effectiveBilling(e) === BillingType.INTERNAL).reduce((s, e) => s + entryHours(e), 0), [entries]);
  const activeMembersCount = useMemo(() => { const ids = new Set<string>(); entries.forEach(e => e.taskHours.forEach(th => ids.add(th.teamMemberId))); return ids.size; }, [entries]);

  const hoursByProject = useMemo(() => {
    const map: Record<string, { name: string; hours: number }> = {};
    entries.forEach(e => {
      const k = e.project?.id ?? "internal";
      const n = e.project?.name ?? "Internal";
      if (!map[k]) map[k] = { name: n, hours: 0 };
      map[k].hours += entryHours(e);
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [entries]);

  const hoursByMember = useMemo(() => {
    const map: Record<string, { name: string; initials: string; hours: number }> = {};
    entries.forEach(e => e.taskHours.forEach(th => {
      const m = members.find(x => x.id === th.teamMemberId);
      if (!m) return;
      if (!map[th.teamMemberId]) map[th.teamMemberId] = { name: m.name, initials: m.initials, hours: 0 };
      map[th.teamMemberId].hours += th.hours;
    }));
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [entries, members]);

  const dailyData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    entries.forEach(e => {
      const day = formatDay(e.date);
      if (!map[day]) map[day] = {};
      e.taskHours.forEach(th => { map[day][th.teamMemberId] = (map[day][th.teamMemberId] ?? 0) + th.hours; });
    });
    return Object.entries(map).sort(([a], [b]) => a < b ? -1 : 1).map(([day, byMember]) => ({ day, ...byMember }));
  }, [entries]);

  const billingData = [
    { name: "Retainership",        value: retainershipHours },
    { name: "Out of Retainership", value: nonRetainerHours },
    { name: "Internal",            value: internalHours },
  ].filter(d => d.value > 0);

  const overtimeData = useMemo(() => {
    const memberDays: Record<string, Record<string, number>> = {};
    entries.forEach(e => {
      const day = toDateStr(e.date);
      e.taskHours.forEach(th => {
        if (!memberDays[th.teamMemberId]) memberDays[th.teamMemberId] = {};
        memberDays[th.teamMemberId][day] = (memberDays[th.teamMemberId][day] ?? 0) + th.hours;
      });
    });
    return members.filter(m => memberDays[m.id]).map(m => {
      const days = memberDays[m.id] ?? {};
      const overtimeDays = Object.values(days).filter(h => h > hoursTarget);
      const totalOvertime = overtimeDays.reduce((s, h) => s + Math.max(0, h - hoursTarget), 0);
      return { id: m.id, name: m.name, initials: m.initials, daysOver: overtimeDays.length, totalOvertime: Math.round(totalOvertime * 10) / 10 };
    }).filter(r => r.daysOver > 0).sort((a, b) => b.daysOver - a.daysOver);
  }, [entries, members, hoursTarget]);

  const { busiestDay, avgDailyHours } = useMemo(() => {
    const dayMap: Record<string, number> = {};
    entries.forEach(e => { const day = formatDay(e.date); dayMap[day] = (dayMap[day] ?? 0) + entryHours(e); });
    const days   = Object.entries(dayMap);
    const busiest = days.sort((a, b) => b[1] - a[1])[0];
    const avg    = days.length > 0 ? totalHours / days.length : 0;
    return { busiestDay: busiest ? `${busiest[0]} (${busiest[1]}h)` : "—", avgDailyHours: avg };
  }, [entries, totalHours]);

  // Hours goal: days below target (Group 13)
  const dayHoursMap = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => { const d = toDateStr(e.date); map[d] = (map[d] ?? 0) + entryHours(e); });
    return map;
  }, [entries]);

  // Business days in range
  const workingDaysInPeriod = useMemo(() => {
    let count = 0;
    let cur = parseISO(startDate);
    const end = parseISO(endDate);
    while (cur <= end) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6) count++;
      cur = addDays(cur, 1);
    }
    return count;
  }, [startDate, endDate]);

  const daysBelowTarget = useMemo(() => {
    return Object.entries(dayHoursMap)
      .filter(([, h]) => h < hoursTarget)
      .map(([day]) => day)
      .sort();
  }, [dayHoursMap, hoursTarget]);

  const avgGoalProgress = useMemo(() => {
    const days = Object.keys(dayHoursMap).length;
    if (!days) return 0;
    return totalHours / days;
  }, [dayHoursMap, totalHours]);

  // Active preset (Group 12)
  const activePreset = useMemo(() => {
    for (const p of PRESETS) {
      const { start, end } = p.getRange();
      if (start === startDate && end === endDate) return p.label;
    }
    return null;
  }, [startDate, endDate]);

  const emptyText = (
    <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-instrument-sans)", fontStyle: "italic" }}>
      No data for this period
    </p>
  );

  // ── Goal progress colors ─────────────────────────────────────────────────────
  const goalRatio  = hoursTarget > 0 ? avgGoalProgress / hoursTarget : 0;
  const goalColor  = goalRatio >= 1 ? "#22C55E" : goalRatio >= 0.7 ? "#F59E0B" : "#EF4444";
  const goalPct    = Math.min(goalRatio * 100, 100);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pt-6">

      {/* ── Group 12: Date range presets ─────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {PRESETS.map(p => {
          const isActive = activePreset === p.label;
          return (
            <motion.button
              key={p.label}
              onClick={() => { const { start, end } = p.getRange(); onStartDateChange(start); onEndDateChange(end); }}
              whileTap={{ scale: 0.97 }}
              style={{
                height: 30, padding: "0 12px",
                background: isActive ? "var(--bg-ink)" : "var(--bg-surface)",
                color: isActive ? "var(--text-on-dark)" : "var(--text-secondary)",
                border: `1px solid ${isActive ? "var(--bg-ink)" : "var(--border-ghost)"}`,
                borderRadius: 20,
                fontFamily: "var(--font-instrument-sans)", fontSize: 12, fontWeight: isActive ? 600 : 400,
                cursor: "pointer", transition: "all 150ms ease",
              }}
            >
              {p.label}
            </motion.button>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* Group 14: Print / PDF */}
        <motion.button
          onClick={() => window.print()}
          whileTap={{ scale: 0.97 }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            height: 30, padding: "0 12px",
            background: "var(--bg-surface)", color: "var(--text-muted)",
            border: "1px solid var(--border-ghost)", borderRadius: 8,
            fontFamily: "var(--font-instrument-sans)", fontSize: 12, fontWeight: 400,
            cursor: "pointer", transition: "all 150ms ease",
          }}
          whileHover={{ color: "var(--text-primary)", borderColor: "var(--border-medium)" } as never}
        >
          <Printer size={12} strokeWidth={1.5} />
          Print / PDF
        </motion.button>
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Overview</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-4">
          <StatCard label="Total Hours"    value={totalHours}         unit="h" index={0} />
          <StatCard label="Retainership"   value={retainershipHours}  unit="h" index={1} />
          <StatCard label="Non-Retainer"   value={nonRetainerHours}   unit="h" index={2} />
          <StatCard label="Active Members" value={activeMembersCount}          index={3} />
        </div>
      </section>

      {/* ── Group 13: Hours Goal Progress card ───────────────────────────── */}
      <section>
        <SectionLabel>Hours Goal</SectionLabel>
        <Card index={4} style={{ padding: 24, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 11, fontWeight: 500, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Avg Daily Hours
            </p>
            <span style={{ fontFamily: "var(--font-martian-mono)", fontSize: 11, color: "var(--text-muted)" }}>
              Target: {hoursTarget}h
            </span>
          </div>

          {/* Value */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 16 }}>
            <span style={{ fontFamily: "var(--font-martian-mono)", fontSize: 28, fontWeight: 400, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
              {avgGoalProgress.toFixed(1)}
            </span>
            <span style={{ fontFamily: "var(--font-martian-mono)", fontSize: 14, color: "var(--text-muted)" }}>h / day</span>
          </div>

          {/* Progress bar */}
          <div style={{ background: "var(--bg-ground)", borderRadius: 6, height: 8, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${goalPct}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              style={{ height: "100%", borderRadius: 6, background: goalColor }}
            />
          </div>

          {/* Days below target */}
          {daysBelowTarget.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                {daysBelowTarget.length} {daysBelowTarget.length === 1 ? "day" : "days"} below target this period
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {daysBelowTarget.map(day => (
                  <motion.button
                    key={day}
                    onClick={() => onJumpToDate(day)}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      height: 24, padding: "0 10px",
                      background: "color-mix(in srgb, #EF4444 8%, transparent)",
                      color: "#B91C1C",
                      border: "1px solid color-mix(in srgb, #EF4444 20%, transparent)",
                      borderRadius: 20,
                      fontFamily: "var(--font-martian-mono)", fontSize: 10, fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {format(parseISO(day), "d MMM")}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {daysBelowTarget.length === 0 && Object.keys(dayHoursMap).length > 0 && (
            <p style={{ marginTop: 12, fontFamily: "var(--font-instrument-sans)", fontSize: 13, color: goalColor }}>
              All tracked days meet the target.
            </p>
          )}
          <p style={{ marginTop: 8, fontFamily: "var(--font-martian-mono)", fontSize: 10, color: "var(--text-muted)", opacity: 0.6 }}>
            {workingDaysInPeriod} working days in this period
          </p>
        </Card>
      </section>

      {/* ── Breakdown ────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Breakdown</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
          <ChartCard title="Hours by Project" index={5}>
            {hoursByProject.length === 0 ? emptyText : (
              <ResponsiveContainer width="100%" height={Math.max(160, hoursByProject.length * 36)}>
                <BarChart data={hoursByProject} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-martian-mono)" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11, fill: "var(--text-secondary)", fontFamily: "var(--font-instrument-sans)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--bg-hover)" }} formatter={(v) => [`${v}h`, "Hours"]} />
                  <Bar dataKey="hours" radius={[0, 6, 6, 0]} isAnimationActive>
                    {hoursByProject.map((_, i) => <Cell key={i} fill={WARM_COLORS[i % WARM_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Hours by Team Member" index={6}>
            {hoursByMember.length === 0 ? emptyText : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={hoursByMember} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                  <XAxis dataKey="initials" tick={{ fontSize: 11, fill: "var(--text-secondary)", fontFamily: "var(--font-martian-mono)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-martian-mono)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--bg-hover)" }} formatter={(v) => [`${v}h`, "Hours"]} labelFormatter={(l) => hoursByMember.find(x => x.initials === l)?.name ?? l} />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]} isAnimationActive>
                    {hoursByMember.map((_, i) => <Cell key={i} fill={WARM_COLORS[i % WARM_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </section>

      {/* ── Daily stacked ─────────────────────────────────────────────────── */}
      <section>
        <ChartCard title="Daily Hours by Person" index={7}>
          {dailyData.length === 0 ? emptyText : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-martian-mono)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-martian-mono)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--bg-hover)" }} />
                {members.filter(m => dailyData.some(d => d[m.id as keyof typeof d])).map((m, i) => (
                  <Bar key={m.id} dataKey={m.id} name={m.initials} stackId="a"
                    fill={WARM_COLORS[i % WARM_COLORS.length]}
                    radius={i === members.length - 1 ? [3, 3, 0, 0] : undefined}
                    isAnimationActive />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      {/* ── Insights ─────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Insights</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
          <ChartCard title="Billing Split" index={8}>
            {billingData.length === 0 ? emptyText : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={billingData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" label={false} labelLine={false} isAnimationActive>
                      {billingData.map((_, i) => <Cell key={i} fill={WARM_COLORS[i]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}h`]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-3">
                  {billingData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: WARM_COLORS[i], flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-martian-mono)" }}>{d.name}</p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-martian-mono)" }}>{d.value}h</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Quick Stats" index={9}>
            <div className="space-y-4">
              {[
                { label: "Busiest day",    value: busiestDay },
                { label: "Avg daily",      value: `${avgDailyHours.toFixed(1)}h` },
                { label: "Total entries",  value: String(entries.length) },
                { label: "Internal hours", value: `${internalHours}h` },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-baseline" style={{ borderBottom: "1px solid var(--border-ghost)", paddingBottom: 12 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-martian-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {row.label}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-instrument-sans)" }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      </section>

      {/* ── Overtime ─────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Overtime</SectionLabel>
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4, ease: "easeOut" }}
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-ghost)", borderRadius: 12, boxShadow: "var(--shadow-sm)", overflow: "hidden", marginTop: 16 }}
        >
          {overtimeData.length === 0 ? (
            <div style={{ padding: "20px 28px" }}>
              <p style={{ fontSize: 14, color: "var(--text-muted)", fontFamily: "var(--font-instrument-sans)", fontStyle: "italic" }}>
                No overtime in this period
              </p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-ground)", borderBottom: "2px solid var(--border-subtle)" }}>
                  {["Team Member", `Days > ${hoursTarget}h`, "Overtime Hours"].map((h, i) => (
                    <th key={h} style={{ padding: "14px 24px", textAlign: i === 0 ? "left" : "right", fontFamily: "var(--font-martian-mono)", fontSize: 10, fontWeight: 500, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overtimeData.map((row, i) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 + i * 0.04 }}
                    style={{ borderBottom: "1px solid var(--border-ghost)" }}
                  >
                    <td style={{ padding: "14px 24px", color: "var(--text-primary)", fontFamily: "var(--font-instrument-sans)", fontWeight: 500 }}>
                      <div className="flex items-center gap-3">
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--bg-ink)", color: "var(--text-on-dark)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "var(--font-martian-mono)", flexShrink: 0 }}>
                          {row.initials}
                        </div>
                        {row.name}
                      </div>
                    </td>
                    <td style={{ padding: "14px 24px", textAlign: "right", fontWeight: 700, color: "var(--color-destructive)", fontFamily: "var(--font-martian-mono)" }}>
                      {row.daysOver}
                    </td>
                    <td style={{ padding: "14px 24px", textAlign: "right", color: "var(--color-destructive)", fontFamily: "var(--font-martian-mono)" }}>
                      {row.totalOvertime}h
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      </section>
    </div>
  );
}
