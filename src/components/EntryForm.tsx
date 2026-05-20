"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { BillingType } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createEntry, updateEntry } from "@/app/actions/entries";

type Project = { id: string; name: string; billingType: BillingType; archivedAt: Date | null };
type Client = { id: string; name: string; hasRetainership: boolean; projects: Project[]; createdAt: Date };
type Member = { id: string; name: string; initials: string };
type ExistingEntry = {
  id: string; date: Date; projectId: string | null;
  taskDescription: string; isMeeting: boolean;
  personCount: number | null; meetingDuration: number | null;
  billingOverride: BillingType | null;
  taskHours: Array<{ teamMemberId: string; hours: number }>;
};

const CLIENT_PILL: Record<number, { bg: string; text: string }> = {
  0: { bg: "#1E3A5F", text: "#93C5FD" },
  1: { bg: "#2A2A28", text: "#D1D5DB" },
  2: { bg: "#1F2D1A", text: "#86EFAC" },
  3: { bg: "#2D1F0A", text: "#FCD34D" },
  4: { bg: "#2D0A0A", text: "#FCA5A5" },
};

function FloatingInput({
  label, value, onChange, type = "text", required,
  min, max, step, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; min?: string; max?: string; step?: string; placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || !!value;

  return (
    <div className="relative pb-1">
      <motion.label
        animate={{ y: lifted ? -18 : 0, scale: lifted ? 0.8 : 1 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="absolute left-0 top-3 origin-left pointer-events-none font-mono"
        style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
          color: focused ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        {label}
      </motion.label>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required} min={min} max={max} step={step} placeholder={placeholder}
        className="w-full pt-6 pb-2 bg-transparent outline-none"
        style={{
          borderBottom: `1px solid ${focused ? "var(--text-primary)" : "var(--border)"}`,
          color: "var(--text-primary)", fontSize: 14,
          transition: "border-color 200ms ease",
        }}
      />
    </div>
  );
}

export default function EntryForm({
  clients, members, existing, onSuccess,
}: {
  clients: Client[]; members: Member[];
  existing?: ExistingEntry; onSuccess?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const today = format(new Date(), "yyyy-MM-dd");

  const [date, setDate] = useState(existing ? format(new Date(existing.date), "yyyy-MM-dd") : today);
  const [projectId, setProjectId] = useState<string | null>(existing?.projectId ?? null);
  const [description, setDescription] = useState(existing?.taskDescription ?? "");
  const [isMeeting, setIsMeeting] = useState(existing?.isMeeting ?? false);
  const [personCount, setPersonCount] = useState(existing?.personCount?.toString() ?? "");
  const [duration, setDuration] = useState(existing?.meetingDuration?.toString() ?? "");
  const [billingOverride, setBillingOverride] = useState<BillingType | null>(existing?.billingOverride ?? null);
  const [memberHours, setMemberHours] = useState<Record<string, string>>(
    () => Object.fromEntries((existing?.taskHours ?? []).map((th) => [th.teamMemberId, th.hours.toString()]))
  );
  const [projectSearch, setProjectSearch] = useState("");
  const [error, setError] = useState("");
  const [savedEntries, setSavedEntries] = useState<Array<{ desc: string; project: string; hours: string }>>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const selectedProject = clients
    .flatMap((c) => c.projects.map((p) => ({ ...p, client: c })))
    .find((p) => p.id === projectId);

  const showBillingOverride = selectedProject?.client?.hasRetainership ?? false;

  function getEffectiveBilling(): BillingType {
    return billingOverride ?? selectedProject?.billingType ?? BillingType.INTERNAL;
  }

  async function save(andClose: boolean) {
    setError("");
    if (!date) { setError("Date required"); return; }
    if (!description.trim()) { setError("Task description required"); return; }
    if (isMeeting) {
      if (!personCount || parseInt(personCount) < 1) { setError("Person count ≥ 1"); return; }
      if (!duration || parseFloat(duration) <= 0) { setError("Duration > 0"); return; }
    } else {
      const valid = Object.entries(memberHours).filter(([, h]) => h && parseFloat(h) > 0);
      if (valid.length === 0) { setError("At least one member with hours > 0"); return; }
    }

    const taskHours = isMeeting
      ? []
      : Object.entries(memberHours)
          .filter(([, h]) => h && parseFloat(h) > 0)
          .map(([teamMemberId, h]) => ({ teamMemberId, hours: parseFloat(h) }));

    const payload = {
      date, projectId: projectId || null,
      taskDescription: description.trim(), isMeeting,
      personCount: isMeeting ? parseInt(personCount) : undefined,
      meetingDuration: isMeeting ? parseFloat(duration) : undefined,
      billingOverride: showBillingOverride ? billingOverride : null,
      taskHours,
    };

    startTransition(async () => {
      if (existing) {
        await updateEntry(existing.id, payload);
        toast.success("Entry updated");
        onSuccess?.();
      } else {
        await createEntry(payload);
        toast.success("Entry saved");

        // Show success state briefly
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 800);

        if (andClose) {
          router.push("/timesheet");
        } else {
          // Add to session summary
          const totalHrs = taskHours.reduce((s, th) => s + th.hours, 0);
          setSavedEntries((prev) => [
            ...prev,
            {
              desc: description.trim(),
              project: selectedProject?.name ?? "Internal",
              hours: isMeeting ? `${duration}h mtg` : `${totalHrs}h`,
            },
          ]);
          // Reset form (keep date)
          setProjectId(null);
          setDescription("");
          setIsMeeting(false);
          setPersonCount("");
          setDuration("");
          setBillingOverride(null);
          setMemberHours({});
        }
      }
    });
  }

  const allProjects = clients.flatMap((c, idx) =>
    c.projects.filter((p) => !p.archivedAt).map((p) => ({ ...p, client: c, clientIndex: idx }))
  );
  const filteredProjects = projectSearch
    ? allProjects.filter((p) =>
        p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.client.name.toLowerCase().includes(projectSearch.toLowerCase())
      )
    : allProjects;
  const groupedProjects = filteredProjects.reduce((acc, p) => {
    if (!acc[p.client.id]) acc[p.client.id] = { client: p.client, projects: [], index: p.clientIndex };
    acc[p.client.id].projects.push(p);
    return acc;
  }, {} as Record<string, { client: Client; projects: typeof allProjects; index: number }>);

  const inputStyle = {
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    fontSize: 13,
    padding: "7px 10px",
    borderRadius: 4,
    outline: "none",
    width: "100%",
  };

  return (
    <div className="space-y-7">
      {/* Date */}
      <div>
        <p className="font-mono mb-2" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Date
        </p>
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          style={{ ...inputStyle, width: "auto", fontFamily: "var(--font-geist-mono)", fontSize: 13 }}
          required
        />
      </div>

      {/* Project */}
      <div>
        <p className="font-mono mb-2" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Project
        </p>
        <input
          type="text" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10 }}
          placeholder="Search projects…"
        />
        <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
          <motion.button
            type="button"
            onClick={() => setProjectId(null)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            style={{
              padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 500,
              background: projectId === null ? "var(--action-primary)" : "var(--accent-bg)",
              color: projectId === null ? "var(--action-primary-text)" : "var(--text-muted)",
              border: "none", cursor: "pointer",
            }}
          >
            Internal
          </motion.button>

          {Object.values(groupedProjects).map(({ client, projects, index }) => (
            <div key={client.id} className="w-full">
              <p className="font-mono mb-1.5" style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", opacity: 0.7 }}>
                {client.name}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {projects.map((p) => {
                  const pill = CLIENT_PILL[index] ?? { bg: "#222220", text: "#9C9A96" };
                  const isSelected = projectId === p.id;
                  return (
                    <motion.button
                      key={p.id} type="button"
                      onClick={() => { setProjectId(p.id); setBillingOverride(null); }}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.93 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      style={{
                        padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: "pointer",
                        background: isSelected ? pill.bg : "var(--accent-bg)",
                        color: isSelected ? pill.text : "var(--text-muted)",
                        border: `1px solid ${isSelected ? pill.bg : "transparent"}`,
                        outline: "none",
                      }}
                    >
                      {p.name}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task Description */}
      <FloatingInput
        label="Task Description"
        value={description}
        onChange={setDescription}
        required
      />

      {/* Entry Type */}
      <div>
        <p className="font-mono mb-2" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Entry Type
        </p>
        <div
          className="inline-flex"
          style={{ border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden", background: "var(--card-bg)" }}
        >
          {(["Task", "Meeting"] as const).map((t) => {
            const active = (t === "Meeting") === isMeeting;
            return (
              <button
                key={t} type="button"
                onClick={() => setIsMeeting(t === "Meeting")}
                className="relative px-5 py-2"
                style={{ fontSize: 13, fontWeight: 500 }}
              >
                {active && (
                  <motion.div
                    layoutId="entry-type-bg"
                    className="absolute inset-0"
                    style={{ background: "var(--action-primary)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <span className="relative" style={{ color: active ? "var(--action-primary-text)" : "var(--text-secondary)" }}>
                  {t}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task: member hours */}
      {!isMeeting && (
        <div>
          <p className="font-mono mb-3" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Hours
          </p>
          <div className="space-y-3">
            {members.map((m) => {
              const hasHours = !!memberHours[m.id] && parseFloat(memberHours[m.id]) > 0;
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-mono flex-shrink-0 text-xs font-bold"
                    style={{
                      background: hasHours ? "var(--action-primary)" : "var(--accent-bg)",
                      color: hasHours ? "var(--action-primary-text)" : "var(--text-muted)",
                      transition: "background 200ms, color 200ms",
                    }}
                  >
                    {m.initials}
                  </div>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{m.name}</span>
                  <input
                    type="number" min="0" max="24" step="0.5"
                    value={memberHours[m.id] ?? ""}
                    onChange={(e) => setMemberHours({ ...memberHours, [m.id]: e.target.value })}
                    className="font-mono text-right"
                    style={{
                      width: 60, borderBottom: "1px solid var(--border)", background: "transparent",
                      outline: "none", fontSize: 14, fontWeight: 500, color: "var(--text-primary)",
                      padding: "4px 0",
                    }}
                    placeholder="0"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meeting fields */}
      {isMeeting && (
        <div className="grid grid-cols-2 gap-5">
          <FloatingInput label="Person Count" value={personCount} onChange={setPersonCount} type="number" min="1" />
          <FloatingInput label="Duration (hrs)" value={duration} onChange={setDuration} type="number" min="0.5" step="0.5" />
        </div>
      )}

      {/* Billing override */}
      {showBillingOverride && (
        <div>
          <p className="font-mono mb-2" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Billing
          </p>
          <div className="inline-flex" style={{ border: "1px solid var(--border)", borderRadius: 4, overflow: "hidden" }}>
            {([BillingType.RETAINERSHIP, BillingType.OUT_OF_RETAINERSHIP] as const).map((b) => {
              const active = getEffectiveBilling() === b;
              return (
                <button key={b} type="button" onClick={() => setBillingOverride(b)}
                  className="relative px-4 py-2"
                  style={{ fontSize: 12, fontWeight: 500 }}
                >
                  {active && (
                    <motion.div layoutId="billing-bg" className="absolute inset-0"
                      style={{ background: "var(--action-primary)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 35 }} />
                  )}
                  <span className="relative" style={{ color: active ? "var(--action-primary-text)" : "var(--text-secondary)" }}>
                    {b === BillingType.RETAINERSHIP ? "Retainership" : "Out of Retainership"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Session summary (non-edit mode) */}
      {!existing && savedEntries.length > 0 && (
        <div>
          <p className="font-mono mb-2" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Saved this session
          </p>
          <div className="space-y-1.5">
            <AnimatePresence>
              {savedEntries.map((e, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="flex items-center gap-2 py-1.5"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <Check size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{e.desc}</span>
                  <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.project}</span>
                  <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{e.hours}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ fontSize: 12, color: "var(--destructive)" }}
        >
          {error}
        </motion.p>
      )}

      {/* CTAs */}
      <div className="flex gap-2 pt-2">
        {!existing && (
          <motion.button
            type="button" onClick={() => save(false)} disabled={isPending}
            className="relative flex-1 overflow-hidden py-2.5 font-medium"
            style={{ background: "var(--action-primary)", color: "var(--action-primary-text)", borderRadius: 4, fontSize: 13 }}
            whileTap={{ scale: 0.97 }}
            whileHover={{ opacity: 0.88 }}
          >
            <AnimatePresence mode="wait">
              {saveSuccess ? (
                <motion.span key="check" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  ✓
                </motion.span>
              ) : (
                <motion.span key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {isPending ? "Saving…" : "Save & Add Another"}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )}
        <motion.button
          type="button" onClick={() => save(true)} disabled={isPending}
          className={cn("py-2.5 font-medium", existing ? "flex-1" : "")}
          style={{
            border: "1px solid var(--border)", background: existing ? "var(--action-primary)" : "transparent",
            color: existing ? "var(--action-primary-text)" : "var(--text-primary)",
            borderRadius: 4, fontSize: 13, padding: existing ? undefined : "10px 16px",
          }}
          whileTap={{ scale: 0.97 }}
          whileHover={{ background: existing ? undefined : "var(--accent-bg)" }}
        >
          {isPending ? "Saving…" : existing ? "Save Changes" : "Save & Close"}
        </motion.button>
        <motion.button
          type="button"
          onClick={() => { if (onSuccess) onSuccess(); else router.push("/timesheet"); }}
          style={{ fontSize: 13, color: "var(--text-muted)", padding: "10px 12px" }}
          whileHover={{ color: "var(--text-primary)" }}
          whileTap={{ scale: 0.97 }}
        >
          Cancel
        </motion.button>
      </div>
    </div>
  );
}
