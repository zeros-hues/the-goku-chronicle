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
import { getClientColors } from "@/components/chronicle/ProjectPill";

type Project       = { id: string; name: string; billingType: BillingType; archivedAt: Date | null };
type Client        = { id: string; name: string; hasRetainership: boolean; projects: Project[]; createdAt: Date };
type Member        = { id: string; name: string; initials: string };
type ExistingEntry = {
  id: string; date: Date; projectId: string | null;
  taskDescription: string; isMeeting: boolean;
  personCount: number | null; meetingDuration: number | null;
  billingOverride: BillingType | null;
  taskHours: Array<{ teamMemberId: string; hours: number }>;
};

// ─── Primitives ───────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily:    "var(--font-martian-mono)",
      fontSize:      10,
      textTransform: "uppercase",
      letterSpacing: "0.10em",
      color:         "var(--text-muted)",
      marginBottom:  8,
    }}>
      {children}
    </p>
  );
}

function FullInput({
  label, value, onChange, type = "text",
  required, min, max, step, placeholder, autoFocus,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; min?: string; max?: string;
  step?: string; placeholder?: string; autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required} min={min} max={max} step={step}
        placeholder={placeholder} autoFocus={autoFocus}
        style={{
          display:      "block",
          width:        "100%",
          height:       44,
          background:   "var(--bg-ground)",
          border:       `1.5px solid ${focused ? "var(--text-primary)" : "var(--border-subtle)"}`,
          borderRadius: 8,
          outline:      "none",
          color:        "var(--text-primary)",
          fontFamily:   "var(--font-instrument-sans)",
          fontSize:     14,
          padding:      "0 14px",
          transition:   "border-color 150ms ease, box-shadow 150ms ease",
          boxShadow:    focused ? "0 0 0 3px rgba(42,31,20,0.08)" : "none",
        }}
      />
    </div>
  );
}

// Segmented tab
function SegTab({ id, label, active, onClick }: { id: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className="relative"
      style={{
        padding:      "0 16px",
        height:       36,
        fontSize:     14,
        fontFamily:   "var(--font-instrument-sans)",
        fontWeight:   active ? 500 : 400,
        border:       "none",
        background:   "transparent",
        cursor:       "pointer",
        color:        active ? "var(--text-primary)" : "var(--text-secondary)",
        transition:   "color 150ms ease",
        borderRadius: 6,
      }}
    >
      {active && (
        <motion.div
          layoutId={id}
          className="absolute inset-0"
          style={{ background: "var(--bg-surface)", borderRadius: 6, boxShadow: "var(--shadow-sm)" }}
          transition={{ ease: [0.25, 0.1, 0.25, 1], duration: 0.15 }}
        />
      )}
      <span className="relative">{label}</span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EntryForm({
  clients, members, existing, onSuccess,
}: {
  clients: Client[]; members: Member[];
  existing?: ExistingEntry; onSuccess?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const today = format(new Date(), "yyyy-MM-dd");

  const [date,            setDate]            = useState(existing ? format(new Date(existing.date), "yyyy-MM-dd") : today);
  const [projectId,       setProjectId]       = useState<string | null>(existing?.projectId ?? null);
  const [description,     setDescription]     = useState(existing?.taskDescription ?? "");
  const [isMeeting,       setIsMeeting]       = useState(existing?.isMeeting ?? false);
  const [personCount,     setPersonCount]     = useState(existing?.personCount?.toString() ?? "");
  const [duration,        setDuration]        = useState(existing?.meetingDuration?.toString() ?? "");
  const [billingOverride, setBillingOverride] = useState<BillingType | null>(existing?.billingOverride ?? null);
  const [memberHours,     setMemberHours]     = useState<Record<string, string>>(
    () => Object.fromEntries((existing?.taskHours ?? []).map(th => [th.teamMemberId, th.hours.toString()]))
  );
  const [projectSearch, setProjectSearch] = useState("");
  const [error,         setError]         = useState("");
  const [savedEntries,  setSavedEntries]  = useState<Array<{ desc: string; project: string; hours: string }>>([]);
  const [saveSuccess,   setSaveSuccess]   = useState(false);

  const selectedProject = clients
    .flatMap(c => c.projects.map(p => ({ ...p, client: c })))
    .find(p => p.id === projectId);
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
      if (!duration || parseFloat(duration) <= 0)    { setError("Duration > 0");     return; }
    } else {
      if (Object.entries(memberHours).filter(([, h]) => h && parseFloat(h) > 0).length === 0) {
        setError("At least one member with hours > 0"); return;
      }
    }

    const taskHours = isMeeting ? [] : Object.entries(memberHours)
      .filter(([, h]) => h && parseFloat(h) > 0)
      .map(([teamMemberId, h]) => ({ teamMemberId, hours: parseFloat(h) }));

    const payload = {
      date, projectId: projectId || null,
      taskDescription: description.trim(), isMeeting,
      personCount:     isMeeting ? parseInt(personCount) : undefined,
      meetingDuration: isMeeting ? parseFloat(duration)  : undefined,
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
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 800);
        if (andClose) {
          router.push("/timesheet");
        } else {
          const totalHrs = taskHours.reduce((s, th) => s + th.hours, 0);
          setSavedEntries(prev => [...prev, {
            desc:    description.trim(),
            project: selectedProject?.name ?? "Internal",
            hours:   isMeeting ? `${duration}h mtg` : `${totalHrs}h`,
          }]);
          setProjectId(null); setDescription(""); setIsMeeting(false);
          setPersonCount(""); setDuration(""); setBillingOverride(null); setMemberHours({});
        }
      }
    });
  }

  const allProjects = clients.flatMap(c => c.projects.filter(p => !p.archivedAt).map(p => ({ ...p, client: c })));
  const filteredProjects = projectSearch
    ? allProjects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()) || p.client.name.toLowerCase().includes(projectSearch.toLowerCase()))
    : allProjects;
  const groupedProjects = filteredProjects.reduce((acc, p) => {
    if (!acc[p.client.id]) acc[p.client.id] = { client: p.client, projects: [] };
    acc[p.client.id].projects.push(p);
    return acc;
  }, {} as Record<string, { client: Client; projects: typeof allProjects }>);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Date */}
      <div>
        <FieldLabel>Date</FieldLabel>
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)} required
          style={{
            background: "var(--bg-ground)", border: "1.5px solid var(--border-subtle)",
            borderRadius: 8, padding: "0 14px", height: 44,
            fontFamily: "var(--font-instrument-sans)", fontSize: 14, color: "var(--text-primary)",
            outline: "none",
          }}
        />
      </div>

      {/* Project */}
      <div>
        <FieldLabel>Project</FieldLabel>
        <input
          type="text" value={projectSearch} onChange={e => setProjectSearch(e.target.value)}
          placeholder="Search…"
          style={{
            display: "block", width: "100%", height: 40, marginBottom: 12,
            background: "var(--bg-ground)", border: "1.5px solid var(--border-subtle)",
            borderRadius: 8, padding: "0 14px",
            fontFamily: "var(--font-instrument-sans)", fontSize: 13, color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 176, overflowY: "auto" }}>
          <PillButton label="Internal" clientName="Goku Studio" selected={projectId === null}
            onClick={() => { setProjectId(null); setBillingOverride(null); }} />
          {Object.values(groupedProjects).map(({ client, projects }) => (
            <div key={client.id}>
              <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6, opacity: 0.65 }}>
                {client.name}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {projects.map(p => (
                  <PillButton key={p.id} label={p.name} clientName={client.name} selected={projectId === p.id}
                    onClick={() => { setProjectId(p.id); setBillingOverride(null); }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task description */}
      <FullInput label="Task Description" value={description} onChange={setDescription} required />

      {/* Entry type */}
      <div>
        <FieldLabel>Entry Type</FieldLabel>
        <div style={{ display: "inline-flex", border: "1.5px solid var(--border-medium)", borderRadius: 8, background: "var(--bg-ground)", padding: 3, gap: 1 }}>
          <SegTab id="entry-type" label="Task"    active={!isMeeting} onClick={() => setIsMeeting(false)} />
          <SegTab id="entry-type" label="Meeting" active={isMeeting}  onClick={() => setIsMeeting(true)}  />
        </div>
      </div>

      {/* Hours / Meeting */}
      <AnimatePresence mode="wait">
        {!isMeeting ? (
          <motion.div key="task" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <FieldLabel>Hours</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {members.map(m => {
                const hasHours = !!memberHours[m.id] && parseFloat(memberHours[m.id]) > 0;
                return (
                  <div key={m.id}
                    style={{
                      display:      "flex",
                      alignItems:   "center",
                      gap:          12,
                      background:   "var(--bg-ground)",
                      border:       "1px solid var(--border-ghost)",
                      borderRadius: 8,
                      padding:      "12px 14px",
                    }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--font-martian-mono)", fontSize: 11, fontWeight: 600,
                      background: hasHours ? "var(--bg-ink)"  : "var(--bg-active)",
                      color:      hasHours ? "var(--text-on-dark)" : "var(--text-secondary)",
                      transition: "background 200ms, color 200ms",
                    }}>
                      {m.initials}
                    </div>
                    <span style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 14, color: "var(--text-primary)", flex: 1 }}>
                      {m.name}
                    </span>
                    <input
                      type="number" min="0" max="24" step="0.5"
                      value={memberHours[m.id] ?? ""} placeholder=""
                      onChange={e => setMemberHours({ ...memberHours, [m.id]: e.target.value })}
                      style={{
                        width: 64, background: "var(--bg-ground)",
                        border: "1.5px solid var(--border-subtle)", borderRadius: 8,
                        outline: "none", fontFamily: "var(--font-martian-mono)",
                        fontSize: 14, fontWeight: 500, color: "var(--text-primary)",
                        textAlign: "right", padding: "0 10px", height: 36,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div key="meeting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            <FullInput label="Attendees"   value={personCount} onChange={setPersonCount} type="number" min="1" />
            <FullInput label="Duration (h)" value={duration}   onChange={setDuration}    type="number" min="0.5" step="0.5" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Billing override */}
      {showBillingOverride && (
        <div>
          <FieldLabel>Billing</FieldLabel>
          <div style={{ display: "inline-flex", border: "1.5px solid var(--border-medium)", borderRadius: 8, background: "var(--bg-ground)", padding: 3, gap: 1 }}>
            {([BillingType.RETAINERSHIP, BillingType.OUT_OF_RETAINERSHIP] as const).map(b => (
              <SegTab key={b} id="billing-type"
                label={b === BillingType.RETAINERSHIP ? "Retainership" : "Out of Retainer"}
                active={getEffectiveBilling() === b}
                onClick={() => setBillingOverride(b)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Session summary */}
      {!existing && savedEntries.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border-ghost)", paddingTop: 16 }}>
          <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)", marginBottom: 10 }}>
            Saved this session
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <AnimatePresence>
              {savedEntries.map((e, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25, delay: i * 0.02 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "var(--bg-ground)", border: "1px solid var(--border-ghost)",
                    borderRadius: 8, padding: "10px 14px",
                  }}
                >
                  <Check size={11} style={{ color: "var(--color-success)", flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 13, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.desc}</span>
                  <span style={{ fontFamily: "var(--font-martian-mono)", fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{e.project}</span>
                  <span style={{ fontFamily: "var(--font-martian-mono)", fontSize: 12, fontWeight: 600, color: "var(--text-primary)", flexShrink: 0 }}>{e.hours}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            style={{ fontFamily: "var(--font-martian-mono)", fontSize: 11, color: "var(--color-destructive)", letterSpacing: "0.02em" }}>
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* CTAs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
        {!existing && (
          <motion.button
            type="button" onClick={() => save(false)} disabled={isPending}
            whileTap={{ scale: 0.97 }}
            style={{
              width: "100%", height: 48,
              background: "var(--bg-ink)", color: "var(--text-on-dark)",
              border: "none", borderRadius: 8,
              fontFamily: "var(--font-instrument-sans)", fontSize: 15, fontWeight: 500,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.65 : 1,
              position: "relative", overflow: "hidden",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <AnimatePresence mode="wait">
              {saveSuccess
                ? <motion.span key="check" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>✓ Saved</motion.span>
                : <motion.span key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{isPending ? "Saving…" : "Save & Add Another"}</motion.span>
              }
            </AnimatePresence>
          </motion.button>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <motion.button
            type="button" onClick={() => save(true)} disabled={isPending}
            whileTap={{ scale: 0.97 }}
            className={cn(existing ? "flex-1" : "")}
            style={{
              height:       44,
              width:        existing ? undefined : 200,
              background:   existing ? "var(--bg-ink)"  : "transparent",
              color:        existing ? "var(--text-on-dark)" : "var(--text-primary)",
              border:       existing ? "none" : "1.5px solid var(--border-medium)",
              borderRadius: 8,
              fontFamily:   "var(--font-instrument-sans)",
              fontSize:     14, fontWeight: 500,
              cursor:       isPending ? "not-allowed" : "pointer",
              opacity:      isPending ? 0.65 : 1,
              padding:      "0 18px",
              boxShadow:    existing ? "var(--shadow-sm)" : "none",
            }}
          >
            {isPending ? "Saving…" : existing ? "Save Changes" : "Save & Close"}
          </motion.button>
          <motion.button
            type="button"
            onClick={() => { if (onSuccess) onSuccess(); else router.push("/timesheet"); }}
            whileHover={{ color: "var(--text-primary)" }}
            style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 14, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer", padding: "0 12px" }}
          >
            Cancel
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function PillButton({ label, clientName, selected, onClick }: { label: string; clientName: string; selected: boolean; onClick: () => void }) {
  const colors = getClientColors(clientName);
  return (
    <motion.button
      type="button" onClick={onClick}
      whileHover={{ y: -1, boxShadow: "var(--shadow-sm)" }}
      transition={{ duration: 0.12, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        display: "inline-flex", alignItems: "center",
        height: 24, padding: "0 10px", borderRadius: 6,
        fontFamily: "var(--font-martian-mono)", fontSize: 11, fontWeight: 500,
        cursor: "pointer",
        border:      `1.5px solid ${selected ? colors.border : "transparent"}`,
        background:  colors.bg,
        color:       colors.text,
        opacity:     selected ? 1 : 0.6,
        transition:  "opacity 150ms ease, background 150ms ease",
      }}
    >
      {label}
    </motion.button>
  );
}
