"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Eye, EyeOff, KeyRound, ShieldCheck, CalendarX, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import PageMotion from "@/components/PageMotion";
import SectionLabel from "@/components/SectionLabel";
import { changePassword, updateUserSettings, addHoliday, removeHoliday } from "@/app/actions/auth";

type Settings = {
  hoursTarget: number;
  overtimeThreshold: number;
  reminderEnabled: boolean;
  reminderTime: string;
};
type Holiday = { id: string; date: Date; label: string | null };

const inputStyle: React.CSSProperties = {
  width: "100%", background: "transparent", border: "none",
  borderBottom: "1px solid var(--border)", outline: "none",
  padding: "8px 0", fontSize: 14, color: "var(--text-primary)",
  fontFamily: "var(--font-geist-sans, sans-serif)",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontFamily: "var(--font-geist-mono, monospace)",
  fontSize: 10, fontWeight: 500, letterSpacing: "0.1em",
  textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 6,
};
const cardStyle: React.CSSProperties = {
  background: "var(--card-bg)", border: "1px solid var(--border)",
  borderRadius: 12, padding: 24,
};

function PasswordStrength({ password }: { password: string }) {
  const score = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 10 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) ? 4
    : /[A-Z]/.test(password) || /[0-9]/.test(password) ? 3
    : 2;
  const colors = ["", "#EF4444", "#F97316", "#EAB308", "#22C55E"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  if (password.length === 0) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= score ? colors[score] : "var(--border)", transition: "background 200ms" }} />
        ))}
      </div>
      <p style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 10, color: colors[score] }}>{labels[score]}</p>
    </div>
  );
}

export default function AccountClient({
  settings: initialSettings, holidays: initialHolidays,
}: {
  settings: Settings;
  holidays: Holiday[];
}) {
  // ── Default credentials ───────────────────────────────────────────────────
  const [showDefault, setShowDefault] = useState(false);

  // ── Change password ───────────────────────────────────────────────────────
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [pwMsg, setPwMsg]           = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwLoading, setPwLoading]   = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) { setPwMsg({ type: "error", text: "New passwords do not match" }); return; }
    if (newPw.length < 6)    { setPwMsg({ type: "error", text: "Password must be at least 6 characters" }); return; }
    setPwLoading(true);
    const result = await changePassword(currentPw, newPw);
    setPwLoading(false);
    if (result.success) {
      setPwMsg({ type: "success", text: "Password changed successfully" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } else {
      setPwMsg({ type: "error", text: result.error ?? "Failed to change password" });
    }
  }

  // ── Work settings ─────────────────────────────────────────────────────────
  const [settings, setSettings]       = useState(initialSettings);
  const [settingsSaving, setSettingsSaving] = useState(false);

  async function handleSaveSettings(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSettingsSaving(true);
    await updateUserSettings(patch);
    setSettingsSaving(false);
    toast.success("Settings saved");
  }

  // ── Holidays ──────────────────────────────────────────────────────────────
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [newDate, setNewDate]   = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [addingHoliday, setAddingHoliday] = useState(false);

  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate) return;
    setAddingHoliday(true);
    await addHoliday(newDate, newLabel || undefined);
    setAddingHoliday(false);
    setNewDate(""); setNewLabel("");
    // Refresh list by re-fetching... but since we're client, just add optimistically
    setHolidays(prev => [...prev, { id: Date.now().toString(), date: new Date(newDate), label: newLabel || null }].sort((a, b) => new Date(a.date) < new Date(b.date) ? -1 : 1));
    toast.success("Holiday added");
  }

  async function handleRemoveHoliday(id: string) {
    await removeHoliday(id);
    setHolidays(prev => prev.filter(h => h.id !== id));
    toast.success("Holiday removed");
  }

  return (
    <PageMotion>
      <div className="p-6 max-w-xl">
        <div className="mb-8">
          <p style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 11, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
            Settings
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Account
          </h1>
        </div>

        {/* ── Default credentials ──────────────────────────────────────────── */}
        <section className="mb-8">
          <SectionLabel>Default Credentials</SectionLabel>
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={cardStyle}>
            <div className="flex items-center gap-3 mb-4">
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <KeyRound size={16} style={{ color: "var(--text-secondary)" }} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Setup Password</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Username: <span style={{ fontFamily: "var(--font-geist-mono, monospace)" }}>admin</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontFamily: "var(--font-geist-mono, monospace)", fontSize: 14, color: "var(--text-primary)", letterSpacing: showDefault ? "0.05em" : "0.2em" }}>
                {showDefault ? "goku2026" : "••••••••"}
              </div>
              <motion.button onClick={() => setShowDefault(!showDefault)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid var(--border)", background: "var(--card-bg)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-geist-sans, sans-serif)", whiteSpace: "nowrap" }}>
                {showDefault ? <EyeOff size={13} /> : <Eye size={13} />}
                {showDefault ? "Hide" : "Reveal"}
              </motion.button>
            </div>
          </motion.div>
        </section>

        {/* ── Work Settings (Group 15) ─────────────────────────────────────── */}
        <section className="mb-8">
          <SectionLabel>Work Settings</SectionLabel>
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }} style={cardStyle} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label style={labelStyle}>Daily Hours Target</label>
                <input
                  type="number" min={0} max={24} step={0.5}
                  value={settings.hoursTarget}
                  onChange={e => setSettings(s => ({ ...s, hoursTarget: parseFloat(e.target.value) || 8 }))}
                  onBlur={() => handleSaveSettings({ hoursTarget: settings.hoursTarget })}
                  style={{ ...inputStyle, width: "auto" }}
                />
              </div>
              <div>
                <label style={labelStyle}>Overtime Threshold</label>
                <input
                  type="number" min={0} max={24} step={0.5}
                  value={settings.overtimeThreshold}
                  onChange={e => setSettings(s => ({ ...s, overtimeThreshold: parseFloat(e.target.value) || 8 }))}
                  onBlur={() => handleSaveSettings({ overtimeThreshold: settings.overtimeThreshold })}
                  style={{ ...inputStyle, width: "auto" }}
                />
              </div>
            </div>

            {/* WhatsApp reminder (Group 22 toggle) */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>Daily reminder via WhatsApp</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Send a reminder if no tasks are logged by the selected time</p>
                </div>
                <motion.button
                  onClick={() => handleSaveSettings({ reminderEnabled: !settings.reminderEnabled })}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                    background: settings.reminderEnabled ? "var(--bg-ink)" : "var(--border-medium)",
                    transition: "background 200ms",
                    position: "relative", flexShrink: 0,
                  }}
                >
                  <motion.div
                    animate={{ x: settings.reminderEnabled ? 20 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    style={{ position: "absolute", top: 2, left: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
                  />
                </motion.button>
              </div>

              <AnimatePresence>
                {settings.reminderEnabled && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden", marginTop: 16 }}>
                    <label style={labelStyle}>Reminder Time</label>
                    <input
                      type="time" value={settings.reminderTime}
                      onChange={e => setSettings(s => ({ ...s, reminderTime: e.target.value }))}
                      onBlur={() => handleSaveSettings({ reminderTime: settings.reminderTime })}
                      style={{ ...inputStyle, width: "auto" }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {settingsSaving && (
              <p style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 11, color: "var(--text-muted)" }}>Saving…</p>
            )}
          </motion.div>
        </section>

        {/* ── Holidays & Non-working Days (Group 16) ───────────────────────── */}
        <section className="mb-8">
          <SectionLabel>Holidays &amp; Non-working Days</SectionLabel>
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.10 }} style={cardStyle}>
            {/* Add form */}
            <form onSubmit={handleAddHoliday} className="flex gap-3 mb-6 items-end">
              <div style={{ flex: "0 0 148px" }}>
                <label style={labelStyle}>Date</label>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Label (optional)</label>
                <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Diwali" style={inputStyle} />
              </div>
              <motion.button type="submit" disabled={addingHoliday || !newDate} whileTap={{ scale: 0.97 }}
                style={{ height: 36, padding: "0 14px", display: "flex", alignItems: "center", gap: 6, background: "var(--bg-ink)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "var(--font-geist-sans, sans-serif)", fontSize: 13, fontWeight: 500, cursor: addingHoliday ? "not-allowed" : "pointer", opacity: addingHoliday ? 0.6 : 1, flexShrink: 0 }}>
                <Plus size={13} />
                Add
              </motion.button>
            </form>

            {/* Holiday list */}
            {holidays.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", gap: 8 }}>
                <CalendarX size={24} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                <p style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 13, color: "var(--text-muted)" }}>No holidays added yet</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--border-ghost)", borderRadius: 8, overflow: "hidden" }}>
                <AnimatePresence>
                  {holidays.map((h, i) => (
                    <motion.div
                      key={h.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: i < holidays.length - 1 ? "1px solid var(--border-ghost)" : "none", background: "var(--bg-ground)" }}
                    >
                      <span style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 }}>
                        {format(new Date(h.date), "dd MMM yyyy")}
                      </span>
                      <span style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 13, color: "var(--text-muted)", flex: 1 }}>
                        {h.label ?? "—"}
                      </span>
                      <motion.button
                        onClick={() => handleRemoveHoliday(h.id)}
                        whileTap={{ scale: 0.97 }}
                        style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                        whileHover={{ color: "var(--color-destructive)" } as never}
                      >
                        <Trash2 size={13} />
                      </motion.button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </section>

        {/* ── Change Password (Group 17) ───────────────────────────────────── */}
        <section>
          <SectionLabel>Security</SectionLabel>
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.15 }} style={cardStyle}>
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div>
                <label style={labelStyle}>Current Password</label>
                <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>New Password</label>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={inputStyle} required minLength={6} />
                <PasswordStrength password={newPw} />
              </div>
              <div>
                <label style={labelStyle}>Confirm New Password</label>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={inputStyle} required />
              </div>

              <AnimatePresence>
                {pwMsg && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: pwMsg.type === "success" ? "color-mix(in srgb, #22c55e 10%, transparent)" : "color-mix(in srgb, var(--color-destructive) 10%, transparent)", border: `1px solid ${pwMsg.type === "success" ? "#22c55e" : "var(--color-destructive)"}` }}>
                    {pwMsg.type === "success" && <ShieldCheck size={14} style={{ color: "#22c55e", flexShrink: 0 }} />}
                    <p style={{ fontSize: 13, color: pwMsg.type === "success" ? "#16a34a" : "var(--color-destructive)" }}>{pwMsg.text}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button type="submit" disabled={pwLoading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                style={{ width: "100%", padding: "11px 0", background: "var(--action-primary)", color: "var(--action-primary-text)", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: pwLoading ? "not-allowed" : "pointer", opacity: pwLoading ? 0.6 : 1, fontFamily: "var(--font-geist-sans, sans-serif)", letterSpacing: "0.01em" }}>
                {pwLoading ? "Updating…" : "Update Password"}
              </motion.button>
            </form>
          </motion.div>
        </section>
      </div>
    </PageMotion>
  );
}
