"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { BillingType } from "@prisma/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import SectionLabel from "@/components/SectionLabel";

type Member = { id: string; name: string; initials: string; isActive: boolean };
type Project = { id: string; name: string; billingType: BillingType; clientId: string };
type Client = { id: string; name: string; hasRetainership: boolean; projects: Project[]; createdAt: Date };
type TaskHour = { teamMemberId: string; hours: number };
type Entry = {
  id: string;
  date: Date;
  project: (Project & { client: Client }) | null;
  isMeeting: boolean;
  personCount: number | null;
  meetingDuration: number | null;
  billingOverride: BillingType | null;
  taskHours: TaskHour[];
};

function effectiveBilling(entry: Entry): BillingType {
  return entry.billingOverride ?? entry.project?.billingType ?? BillingType.INTERNAL;
}

function entryHours(entry: Entry): number {
  if (entry.isMeeting) return entry.meetingDuration ?? 0;
  return entry.taskHours.reduce((s, th) => s + th.hours, 0);
}

function useCountUp(target: number, duration = 1000) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target * 10) / 10);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

function StatCard({
  label,
  value,
  unit,
  index,
}: {
  label: string;
  value: number;
  unit?: string;
  index: number;
}) {
  const displayed = useCountUp(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: "easeOut" }}
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "20px 24px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 8,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 36,
          fontWeight: 700,
          lineHeight: 1,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
        }}
      >
        {displayed}
        {unit && (
          <span style={{ fontSize: 18, fontWeight: 400, color: "var(--text-muted)", marginLeft: 3 }}>
            {unit}
          </span>
        )}
      </p>
    </motion.div>
  );
}

function ChartCard({
  title,
  children,
  index,
}: {
  title: string;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.16 + index * 0.06, ease: "easeOut" }}
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "20px 24px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 16,
        }}
      >
        {title}
      </p>
      {children}
    </motion.div>
  );
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const MONO_COLORS = ["#1A1918", "#3D3A35", "#5E5A52", "#8A857C", "#B5B0A7"];

const tooltipStyle = {
  background: "var(--card-bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 12,
  fontFamily: "var(--font-geist-mono, monospace)",
};

export default function DashboardView({
  entries,
  members,
  clients,
}: {
  entries: Entry[];
  members: Member[];
  clients: Client[];
}) {
  const totalHours = useMemo(
    () => entries.reduce((s, e) => s + entryHours(e), 0),
    [entries]
  );

  const retainershipHours = useMemo(
    () =>
      entries
        .filter((e) => effectiveBilling(e) === BillingType.RETAINERSHIP)
        .reduce((s, e) => s + entryHours(e), 0),
    [entries]
  );

  const nonRetainershipHours = useMemo(
    () =>
      entries
        .filter((e) => effectiveBilling(e) === BillingType.OUT_OF_RETAINERSHIP)
        .reduce((s, e) => s + entryHours(e), 0),
    [entries]
  );

  const internalHours = useMemo(
    () =>
      entries
        .filter((e) => effectiveBilling(e) === BillingType.INTERNAL)
        .reduce((s, e) => s + entryHours(e), 0),
    [entries]
  );

  const activeMembersCount = useMemo(() => {
    const ids = new Set<string>();
    entries.forEach((e) => e.taskHours.forEach((th) => ids.add(th.teamMemberId)));
    return ids.size;
  }, [entries]);

  const hoursByProject = useMemo(() => {
    const map: Record<string, { name: string; hours: number }> = {};
    entries.forEach((e) => {
      const key = e.project?.id ?? "internal";
      const name = e.project?.name ?? "Internal";
      if (!map[key]) map[key] = { name, hours: 0 };
      map[key].hours += entryHours(e);
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [entries]);

  const hoursByMember = useMemo(() => {
    const map: Record<string, { name: string; initials: string; hours: number }> = {};
    entries.forEach((e) =>
      e.taskHours.forEach((th) => {
        const m = members.find((x) => x.id === th.teamMemberId);
        if (!m) return;
        if (!map[th.teamMemberId])
          map[th.teamMemberId] = { name: m.name, initials: m.initials, hours: 0 };
        map[th.teamMemberId].hours += th.hours;
      })
    );
    return Object.values(map).sort((a, b) => b.hours - a.hours);
  }, [entries, members]);

  const dailyData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    entries.forEach((e) => {
      const day = format(new Date(e.date), "dd MMM");
      if (!map[day]) map[day] = {};
      e.taskHours.forEach((th) => {
        map[day][th.teamMemberId] = (map[day][th.teamMemberId] ?? 0) + th.hours;
      });
    });
    return Object.entries(map)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, byMember]) => ({ day, ...byMember }));
  }, [entries]);

  const billingData = [
    { name: "Retainership", value: retainershipHours },
    { name: "Out of Retainership", value: nonRetainershipHours },
    { name: "Internal", value: internalHours },
  ].filter((d) => d.value > 0);

  const overtimeData = useMemo(() => {
    const memberDays: Record<string, Record<string, number>> = {};
    entries.forEach((e) => {
      const day = format(new Date(e.date), "yyyy-MM-dd");
      e.taskHours.forEach((th) => {
        if (!memberDays[th.teamMemberId]) memberDays[th.teamMemberId] = {};
        memberDays[th.teamMemberId][day] =
          (memberDays[th.teamMemberId][day] ?? 0) + th.hours;
      });
    });

    return members
      .filter((m) => memberDays[m.id])
      .map((m) => {
        const days = memberDays[m.id] ?? {};
        const overtimeDays = Object.values(days).filter((h) => h > 8);
        const totalOvertime = overtimeDays.reduce(
          (s, h) => s + Math.max(0, h - 8),
          0
        );
        return {
          id: m.id,
          name: m.name,
          initials: m.initials,
          daysOver: overtimeDays.length,
          totalOvertime: Math.round(totalOvertime * 10) / 10,
        };
      })
      .filter((r) => r.daysOver > 0)
      .sort((a, b) => b.daysOver - a.daysOver);
  }, [entries, members]);

  const { busiestDay, avgDailyHours } = useMemo(() => {
    const dayMap: Record<string, number> = {};
    entries.forEach((e) => {
      const day = format(new Date(e.date), "dd MMM");
      dayMap[day] = (dayMap[day] ?? 0) + entryHours(e);
    });
    const days = Object.entries(dayMap);
    const busiest = days.sort((a, b) => b[1] - a[1])[0];
    const totalDays = days.length;
    const avg = totalDays > 0 ? totalHours / totalDays : 0;
    return {
      busiestDay: busiest ? `${busiest[0]} (${busiest[1]}h)` : "—",
      avgDailyHours: avg.toFixed(1),
    };
  }, [entries, totalHours]);

  // Suppress unused variable warning
  void clients;

  const emptyText = (
    <p style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
      No data for this period
    </p>
  );

  return (
    <div className="space-y-8">
      {/* Overview cards */}
      <section>
        <SectionLabel>Overview</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Hours" value={totalHours} unit="h" index={0} />
          <StatCard label="Retainership" value={retainershipHours} unit="h" index={1} />
          <StatCard label="Non-Retainer" value={nonRetainershipHours} unit="h" index={2} />
          <StatCard label="Active Members" value={activeMembersCount} index={3} />
        </div>
      </section>

      {/* Charts row */}
      <section>
        <SectionLabel>Breakdown</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Hours by Project" index={0}>
            {hoursByProject.length === 0 ? emptyText : (
              <ResponsiveContainer width="100%" height={Math.max(160, hoursByProject.length * 36)}>
                <BarChart data={hoursByProject} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-geist-mono, monospace)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={90}
                    tick={{ fontSize: 11, fill: "var(--text-secondary)", fontFamily: "var(--font-geist-sans, sans-serif)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: "var(--border)", opacity: 0.5 }}
                    formatter={(v) => [`${v}h`, "Hours"]}
                  />
                  <Bar dataKey="hours" radius={[0, 4, 4, 0]} isAnimationActive={true}>
                    {hoursByProject.map((_, i) => (
                      <Cell key={i} fill={MONO_COLORS[i % MONO_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Hours by Team Member" index={1}>
            {hoursByMember.length === 0 ? emptyText : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={hoursByMember} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                  <XAxis
                    dataKey="initials"
                    tick={{ fontSize: 11, fill: "var(--text-secondary)", fontFamily: "var(--font-geist-mono, monospace)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-geist-mono, monospace)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: "var(--border)", opacity: 0.5 }}
                    formatter={(v) => [`${v}h`, "Hours"]}
                    labelFormatter={(l) => hoursByMember.find((x) => x.initials === l)?.name ?? l}
                  />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]} isAnimationActive={true}>
                    {hoursByMember.map((_, i) => (
                      <Cell key={i} fill={MONO_COLORS[i % MONO_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </section>

      {/* Daily stacked */}
      <section>
        <ChartCard title="Daily Hours by Person" index={2}>
          {dailyData.length === 0 ? emptyText : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-geist-mono, monospace)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--text-muted)", fontFamily: "var(--font-geist-mono, monospace)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--border)", opacity: 0.5 }}
                />
                {members.filter((m) => dailyData.some((d) => d[m.id as keyof typeof d])).map((m, i) => (
                  <Bar
                    key={m.id}
                    dataKey={m.id}
                    name={m.initials}
                    stackId="a"
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    radius={i === members.length - 1 ? [3, 3, 0, 0] : undefined}
                    isAnimationActive={true}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      {/* Billing + quick stats */}
      <section>
        <SectionLabel>Insights</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Billing Split" index={3}>
            {billingData.length === 0 ? emptyText : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={billingData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      dataKey="value"
                      label={false}
                      labelLine={false}
                      isAnimationActive={true}
                    >
                      {billingData.map((_, i) => (
                        <Cell key={i} fill={MONO_COLORS[i]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v) => [`${v}h`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-3">
                  {billingData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: MONO_COLORS[i],
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-geist-mono, monospace)" }}>
                          {d.name}
                        </p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                          {d.value}h
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>

          <ChartCard title="Quick Stats" index={4}>
            <div className="space-y-4">
              {[
                { label: "Busiest day", value: busiestDay },
                { label: "Avg daily hours", value: `${avgDailyHours}h` },
                { label: "Total entries", value: String(entries.length) },
                { label: "Internal hours", value: `${internalHours}h` },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between items-baseline"
                  style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-geist-mono, monospace)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {row.label}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      </section>

      {/* Overtime tracker */}
      <section>
        <SectionLabel>Overtime</SectionLabel>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4, ease: "easeOut" }}
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {overtimeData.length === 0 ? (
            <div style={{ padding: "20px 24px" }}>
              <p style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
                No overtime in this period
              </p>
            </div>
          ) : (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Team Member", "Days > 8h", "Overtime Hours"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 24px",
                        textAlign: i === 0 ? "left" : "right",
                        fontFamily: "var(--font-geist-mono, monospace)",
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overtimeData.map((row, i) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.42 + i * 0.04 }}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td style={{ padding: "14px 24px", color: "var(--text-primary)", fontWeight: 500 }}>
                      <div className="flex items-center gap-3">
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            background: "var(--action-primary)",
                            color: "var(--action-primary-text)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 700,
                            fontFamily: "var(--font-geist-mono, monospace)",
                            flexShrink: 0,
                          }}
                        >
                          {row.initials}
                        </div>
                        {row.name}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "14px 24px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: "var(--destructive)",
                        fontFamily: "var(--font-geist-mono, monospace)",
                      }}
                    >
                      {row.daysOver}
                    </td>
                    <td
                      style={{
                        padding: "14px 24px",
                        textAlign: "right",
                        color: "var(--destructive)",
                        fontFamily: "var(--font-geist-mono, monospace)",
                      }}
                    >
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
