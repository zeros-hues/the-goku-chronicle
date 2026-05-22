"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { BillingType } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createEntry, updateEntry } from "@/app/actions/entries";
import { getClientColors } from "@/components/chronicle/ProjectPill";

// ─── Types ────────────────────────────────────────────────────────────────────

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

export type PrefillData = {
  date?: string;
  projectId?: string | null;
  taskDescription?: string;
  isMeeting?: boolean;
  personCount?: number;
  meetingDuration?: number;
  billingOverride?: BillingType | null;
  taskHours?: Array<{ teamMemberId: string; hours: number }>;
};

// ─── Draft helpers ────────────────────────────────────────────────────────────

const DRAFT_KEY    = "chronicle_entry_draft";
const DRAFT_EXPIRY = 24 * 60 * 60 * 1000;

type DraftState = {
  savedAt: number;
  date: string;
  projectId: string | null;
  description: string;
  isMeeting: boolean;
  personCount: string;
  duration: string;
  billingOverride: BillingType | null;
  memberHours: Record<string, string>;
};

function getDraft(): DraftState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d: DraftState = JSON.parse(raw);
    if (Date.now() - d.savedAt > DRAFT_EXPIRY) { localStorage.removeItem(DRAFT_KEY); return null; }
    return d;
  } catch { return null; }
}
function persistDraft(s: Omit<DraftState, "savedAt">) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...s, savedAt: Date.now() })); } catch {}
}
function clearDraft() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}
function draftAge(savedAt: number): string {
  const m = Math.floor((Date.now() - savedAt) / 60000);
  if (m < 1) return "less than a minute";
  if (m < 60) return `${m} minute${m !== 1 ? "s" : ""}`;
  const h = Math.floor(m / 60);
  return `${h} hour${h !== 1 ? "s" : ""}`;
}

// ─── Recently-used projects ───────────────────────────────────────────────────

const RECENT_KEY = "chronicle_recent_projects";
const MAX_RECENT = 5;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}
function saveRecent(id: string) {
  if (typeof window === "undefined") return;
  try {
    const prev = loadRecent().filter(x => x !== id);
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...prev].slice(0, MAX_RECENT)));
  } catch {}
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)", marginBottom: 8 }}>
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
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required} min={min} max={max} step={step}
        placeholder={placeholder} autoFocus={autoFocus}
        style={{
          display: "block", width: "100%", height: 44,
          background: "var(--bg-ground)",
          border: `1.5px solid ${focused ? "var(--text-primary)" : "var(--border-subtle)"}`,
          borderRadius: 8, outline: "none",
          color: "var(--text-primary)", fontFamily: "var(--font-instrument-sans)", fontSize: 14, padding: "0 14px",
          transition: "border-color 150ms ease, box-shadow 150ms ease",
          boxShadow: focused ? "0 0 0 3px rgba(42,31,20,0.08)" : "none",
        }}
      />
    </div>
  );
}

function SegTab({ id, label, active, onClick }: { id: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="relative"
      style={{ padding: "0 16px", height: 36, fontSize: 14, fontFamily: "var(--font-instrument-sans)", fontWeight: active ? 500 : 400, border: "none", background: "transparent", cursor: "pointer", color: active ? "var(--text-primary)" : "var(--text-secondary)", transition: "color 150ms ease", borderRadius: 6 }}
    >
      {active && (
        <motion.div layoutId={id} className="absolute inset-0"
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
  clients, members, existing, prefill, onSuccess,
}: {
  clients: Client[]; members: Member[];
  existing?: ExistingEntry;
  prefill?: PrefillData;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const today = format(new Date(), "yyyy-MM-dd");
  const isNewEntry = !existing;

  // ── State ──────────────────────────────────────────────────────────────────

  const [date,            setDate]            = useState(existing ? format(new Date(existing.date), "yyyy-MM-dd") : (prefill?.date ?? today));
  const [projectId,       setProjectId]       = useState<string | null>(existing?.projectId ?? prefill?.projectId ?? null);
  const [description,     setDescription]     = useState(existing?.taskDescription ?? prefill?.taskDescription ?? "");
  const [isMeeting,       setIsMeeting]       = useState(existing?.isMeeting ?? prefill?.isMeeting ?? false);
  const [personCount,     setPersonCount]     = useState((existing?.personCount ?? prefill?.personCount)?.toString() ?? "");
  const [duration,        setDuration]        = useState((existing?.meetingDuration ?? prefill?.meetingDuration)?.toString() ?? "");
  const [billingOverride, setBillingOverride] = useState<BillingType | null>(existing?.billingOverride ?? prefill?.billingOverride ?? null);
  const [memberHours,     setMemberHours]     = useState<Record<string, string>>(
    () => Object.fromEntries((existing?.taskHours ?? prefill?.taskHours ?? []).map(th => [th.teamMemberId, th.hours.toString()]))
  );
  const [projectSearch,   setProjectSearch]   = useState("");
  const [error,           setError]           = useState("");
  const [savedEntries,    setSavedEntries]    = useState<Array<{ desc: string; project: string; hours: string }>>([]);
  const [saveSuccess,     setSaveSuccess]     = useState(false);

  // Recently used projects (Group 10)
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecent());

  // Draft auto-save (Group 11) — only for true new entries (not edit, not duplicate)
  const isDraftMode = isNewEntry && !prefill;
  const [pendingDraft, setPendingDraft] = useState<DraftState | null>(null);
  useEffect(() => {
    if (!isDraftMode) return;
    const d = getDraft();
    if (d) setPendingDraft(d);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save interval
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isDraftMode) return;
    autoSaveRef.current = setInterval(() => {
      persistDraft({ date, projectId, description, isMeeting, personCount, duration, billingOverride, memberHours });
    }, 2000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [date, projectId, description, isMeeting, personCount, duration, billingOverride, memberHours, isDraftMode]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const allProjects = clients.flatMap(c => c.projects.filter(p => !p.archivedAt).map(p => ({ ...p, client: c })));
  const recentProjects = recentIds.map(id => allProjects.find(p => p.id === id)).filter(Boolean) as typeof allProjects;
  const filteredProjects = projectSearch
    ? allProjects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()) || p.client.name.toLowerCase().includes(projectSearch.toLowerCase()))
    : allProjects;
  const groupedProjects = filteredProjects.reduce((acc, p) => {
    if (!acc[p.client.id]) acc[p.client.id] = { client: p.client, projects: [] };
    acc[p.client.id].projects.push(p);
    return acc;
  }, {} as Record<string, { client: Client; projects: typeof allProjects }>);

  const selectedProject = allProjects.find(p => p.id === projectId);
  const showBillingOverride = selectedProject?.client?.hasRetainership ?? false;
  function getEffectiveBilling(): BillingType {
    return billingOverride ?? selectedProject?.billingType ?? BillingType.INTERNAL;
  }

  // ── Project select ────────────────────────────────────────────────────────

  function selectProject(id: string | null) {
    setProjectId(id);
    setBillingOverride(null);
    if (id) {
      const updated = [id, ...recentIds.filter(r => r !== id)].slice(0, MAX_RECENT);
      setRecentIds(updated);
      saveRecent(id);
    }
  }

  // ── Draft actions ──────────────────────────────────────────────────────────

  function restoreDraft() {
    if (!pendingDraft) return;
    setDate(pendingDraft.date);
    selectProject(pendingDraft.projectId);
    setDescription(pendingDraft.description);
    setIsMeeting(pendingDraft.isMeeting);
    setPersonCount(pendingDraft.personCount);
    setDuration(pendingDraft.duration);
    setBillingOverride(pendingDraft.billingOverride);
    setMemberHours(pendingDraft.memberHours);
    setPendingDraft(null);
  }

  function discardDraft() {
    clearDraft();
    setPendingDraft(null);
  }

  // ── Save ───────────────────────────────────────────────────────────────────

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
        clearDraft();
        toast.success("Entry updated");
        onSuccess?.();
      } else {
        const created = await createEntry(payload);
        clearDraft();
        toast.success("Entry saved");
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 800);
        if (andClose) {
          if (typeof window !== "undefined") localStorage.setItem("chronicle_new_entry", created.id);
          router.push("/timesheet");
        } else {
          const totalHrs = taskHours.reduce((s, th) => s + th.hours, 0);
          setSavedEntries(prev => [...prev, {
            desc:    description.trim(),
            project: selectedProject?.name ?? "Internal",
            hours:   isMeeting ? `${duration}h mtg` : `${totalHrs}h`,
          }]);
          // Reset for next entry
          setProjectId(null); setDescription(""); setIsMeeting(false);
          setPersonCount(""); setDuration(""); setBillingOverride(null); setMemberHours({});
        }
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Draft restore banner (Group 11) */}
      <AnimatePresence>
        {pendingDraft && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              background: "color-mix(in srgb, #F59E0B 10%, var(--bg-surface))",
              border: "1px solid color-mix(in srgb, #F59E0B 35%, transparent)",
              borderRadius: 10, padding: "12px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={14} style={{ color: "#B45309", flexShrink: 0 }} />
              <p style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 13, color: "var(--text-primary)" }}>
                Unsaved draft from {draftAge(pendingDraft.savedAt)} ago
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <motion.button
                type="button" onClick={restoreDraft}
                whileTap={{ scale: 0.97 }}
                style={{ height: 28, padding: "0 12px", background: "#B45309", color: "#FFF", border: "none", borderRadius: 6, fontFamily: "var(--font-instrument-sans)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
              >
                Restore
              </motion.button>
              <button
                type="button" onClick={discardDraft}
                style={{ height: 28, padding: "0 12px", background: "transparent", color: "var(--text-muted)", border: "none", borderRadius: 6, fontFamily: "var(--font-instrument-sans)", fontSize: 12, cursor: "pointer" }}
              >
                Start fresh
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Date */}
      <div>
        <FieldLabel>Date</FieldLabel>
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)} required
          style={{ background: "var(--bg-ground)", border: "1.5px solid var(--border-subtle)", borderRadius: 8, padding: "0 14px", height: 44, fontFamily: "var(--font-instrument-sans)", fontSize: 14, color: "var(--text-primary)", outline: "none" }}
        />
      </div>

      {/* Project (Group 10: recently used) */}
      <div>
        <FieldLabel>Project</FieldLabel>
        <input
          type="text" value={projectSearch} onChange={e => setProjectSearch(e.target.value)}
          placeholder="Search…"
          style={{ display: "block", width: "100%", height: 40, marginBottom: 12, background: "var(--bg-ground)", border: "1.5px solid var(--border-subtle)", borderRadius: 8, padding: "0 14px", fontFamily: "var(--font-instrument-sans)", fontSize: 13, color: "var(--text-primary)", outline: "none" }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 200, overflowY: "auto" }}>
          {/* Internal pill always first */}
          <PillButton label="Internal" clientName="Goku Studio" selected={projectId === null}
            onClick={() => selectProject(null)} />

          {/* Recently used section (Group 10) */}
          {!projectSearch && recentProjects.length > 0 && (
            <div>
              <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)", marginBottom: 6, opacity: 0.6 }}>
                Recent
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {recentProjects.map(p => (
                  <PillButton key={p.id} label={p.name} clientName={p.client.name} selected={projectId === p.id}
                    onClick={() => selectProject(p.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Client-grouped projects */}
          {Object.values(groupedProjects).map(({ client, projects }) => (
            <div key={client.id}>
              <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6, opacity: 0.65 }}>
                {client.name}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {projects.map(p => (
                  <PillButton key={p.id} label={p.name} clientName={client.name} selected={projectId === p.id}
                    onClick={() => selectProject(p.id)} />
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
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-ground)", border: "1px solid var(--border-ghost)", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-martian-mono)", fontSize: 11, fontWeight: 600, background: hasHours ? "var(--bg-ink)" : "var(--bg-active)", color: hasHours ? "var(--text-on-dark)" : "var(--text-secondary)", transition: "background 200ms, color 200ms" }}>
                      {m.initials}
                    </div>
                    <span style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 14, color: "var(--text-primary)", flex: 1 }}>{m.name}</span>
                    <input
                      type="number" min="0" max="24" step="0.5"
                      value={memberHours[m.id] ?? ""} placeholder=""
                      onChange={e => setMemberHours({ ...memberHours, [m.id]: e.target.value })}
                      style={{ width: 64, background: "var(--bg-ground)", border: "1.5px solid var(--border-subtle)", borderRadius: 8, outline: "none", fontFamily: "var(--font-martian-mono)", fontSize: 14, fontWeight: 500, color: "var(--text-primary)", textAlign: "right", padding: "0 10px", height: 36, fontVariantNumeric: "tabular-nums" }}
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

      {/* Session summary (new entry only) */}
      {!existing && savedEntries.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border-ghost)", paddingTop: 16 }}>
          <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.10em", color: "var(--text-muted)", marginBottom: 10 }}>
            Saved this session
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <AnimatePresence>
              {savedEntries.map((e, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25, delay: i * 0.02 }}
                  style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-ground)", border: "1px solid var(--border-ghost)", borderRadius: 8, padding: "10px 14px" }}
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
            style={{ width: "100%", height: 48, background: "var(--bg-ink)", color: "var(--text-on-dark)", border: "none", borderRadius: 8, fontFamily: "var(--font-instrument-sans)", fontSize: 15, fontWeight: 500, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.65 : 1, position: "relative", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}
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
            style={{ height: 44, width: existing ? undefined : 200, background: existing ? "var(--bg-ink)" : "transparent", color: existing ? "var(--text-on-dark)" : "var(--text-primary)", border: existing ? "none" : "1.5px solid var(--border-medium)", borderRadius: 8, fontFamily: "var(--font-instrument-sans)", fontSize: 14, fontWeight: 500, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.65 : 1, padding: "0 18px", boxShadow: existing ? "var(--shadow-sm)" : "none" }}
          >
            {isPending ? "Saving…" : existing ? "Save Changes" : "Save & Close"}
          </motion.button>
          <motion.button
            type="button"
            onClick={() => { clearDraft(); if (onSuccess) onSuccess(); else router.push("/timesheet"); }}
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

// ─── PillButton ───────────────────────────────────────────────────────────────

function PillButton({ label, clientName, selected, onClick }: { label: string; clientName: string; selected: boolean; onClick: () => void }) {
  const colors = getClientColors(clientName);
  return (
    <motion.button
      type="button" onClick={onClick}
      whileHover={{ y: -1, boxShadow: "var(--shadow-sm)" }}
      transition={{ duration: 0.12, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", borderRadius: 6, fontFamily: "var(--font-martian-mono)", fontSize: 11, fontWeight: 500, cursor: "pointer", border: `1.5px solid ${selected ? colors.border : "transparent"}`, background: colors.bg, color: colors.text, opacity: selected ? 1 : 0.6, transition: "opacity 150ms ease, background 150ms ease" }}
    >
      {label}
    </motion.button>
  );
}
