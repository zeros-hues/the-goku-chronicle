"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, X, Check, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import SectionLabel from "@/components/SectionLabel";
import {
  createTeamMember,
  getTeamMembers,
} from "@/app/actions/team";

type Member = {
  id: string;
  name: string;
  initials: string;
  whatsappNumber: string | null;
  isActive: boolean;
};

// ─── Shared styles ─────────────────────────────────────────────────────────────

const fieldLabelStyle: React.CSSProperties = {
  display:       "block",
  fontFamily:    "var(--font-martian-mono)",
  fontSize:      10,
  fontWeight:    500,
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  color:         "var(--text-muted)",
  marginBottom:  6,
};

function FieldInput({
  label, value, onChange, type = "text", placeholder, maxLength, autoFocus, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; maxLength?: number;
  autoFocus?: boolean; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={fieldLabelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        required={required}
        style={{
          display:      "block",
          width:        "100%",
          height:       40,
          background:   "var(--bg-ground)",
          border:       `1.5px solid ${focused ? "var(--text-primary)" : "var(--border-subtle)"}`,
          borderRadius: 8,
          outline:      "none",
          color:        "var(--text-primary)",
          fontFamily:   "var(--font-instrument-sans)",
          fontSize:     14,
          padding:      "0 12px",
          boxShadow:    focused ? "0 0 0 3px rgba(42,31,20,0.08)" : "none",
          transition:   "border-color 150ms ease, box-shadow 150ms ease",
        }}
      />
    </div>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ initials, isActive = true }: { initials: string; isActive?: boolean }) {
  return (
    <div style={{
      width:       36,
      height:      36,
      borderRadius:"50%",
      background:  isActive ? "var(--bg-ink)"    : "var(--bg-active)",
      color:       isActive ? "var(--text-on-dark)" : "var(--text-secondary)",
      display:     "flex",
      alignItems:  "center",
      justifyContent: "center",
      fontSize:    11,
      fontWeight:  700,
      fontFamily:  "var(--font-martian-mono)",
      flexShrink:  0,
    }}>
      {initials || "?"}
    </div>
  );
}

// ─── Inline edit row ───────────────────────────────────────────────────────────

function EditRow({
  member,
  onSave,
  onCancel,
  isPending,
}: {
  member: Member;
  onSave: (name: string, initials: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name,     setName]     = useState(member.name);
  const [initials, setInitials] = useState(member.initials);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !initials.trim()) return;
    onSave(name.trim(), initials.trim().toUpperCase());
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: "16px 20px" }}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <FieldInput label="Name" value={name} onChange={setName} autoFocus required />
        <FieldInput
          label="Initials"
          value={initials}
          onChange={(v) => setInitials(v.toUpperCase())}
          placeholder="e.g. DK"
          maxLength={4}
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          type="submit"
          disabled={isPending}
          whileTap={{ scale: 0.97 }}
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          6,
            padding:      "0 16px",
            height:       36,
            background:   "var(--bg-ink)",
            color:        "var(--text-on-dark)",
            border:       "none",
            borderRadius: 8,
            fontSize:     13,
            fontFamily:   "var(--font-instrument-sans)",
            fontWeight:   500,
            cursor:       isPending ? "not-allowed" : "pointer",
            opacity:      isPending ? 0.65 : 1,
            boxShadow:    "var(--shadow-sm)",
          }}
        >
          <Check size={13} strokeWidth={2} />
          {isPending ? "Saving…" : "Save"}
        </motion.button>

        <motion.button
          type="button"
          onClick={onCancel}
          whileTap={{ scale: 0.97 }}
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          6,
            padding:      "0 14px",
            height:       36,
            background:   "transparent",
            color:        "var(--text-secondary)",
            border:       "1.5px solid var(--border-medium)",
            borderRadius: 8,
            fontSize:     13,
            fontFamily:   "var(--font-instrument-sans)",
            fontWeight:   500,
            cursor:       "pointer",
          }}
        >
          <X size={13} strokeWidth={2} />
          Cancel
        </motion.button>
      </div>
    </form>
  );
}

// ─── Display row ───────────────────────────────────────────────────────────────

function DisplayRow({
  member,
  onEdit,
}: {
  member: Member;
  onEdit: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        padding:         "14px 20px",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "space-between",
        background:      hovered ? "var(--bg-hover)" : "transparent",
        transition:      "background 150ms ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-3">
        <Avatar initials={member.initials} isActive={member.isActive} />
        <div>
          <p style={{
            fontFamily: "var(--font-instrument-sans)",
            fontWeight: 500,
            fontSize:   14,
            color:      "var(--text-primary)",
          }}>
            {member.name}
          </p>
          {member.whatsappNumber && (
            <p style={{
              fontSize:   11,
              fontFamily: "var(--font-martian-mono)",
              color:      "var(--text-muted)",
              display:    "flex",
              alignItems: "center",
              gap:        4,
              marginTop:  2,
            }}>
              <Phone size={9} />
              {member.whatsappNumber}
            </p>
          )}
        </div>
      </div>

      <motion.button
        aria-label={`Edit ${member.name}`}
        onClick={onEdit}
        animate={{ scale: hovered ? 1.1 : 1, rotate: hovered ? -8 : 0, opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        style={{
          width:        32,
          height:       32,
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          borderRadius: 6,
          background:   "transparent",
          color:        "var(--text-secondary)",
          border:       "none",
          cursor:       "pointer",
        }}
      >
        <Pencil size={14} strokeWidth={1.5} />
      </motion.button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function TeamClient({ initialMembers }: { initialMembers: Member[] }) {
  const [members,    setMembers]   = useState(initialMembers);
  const [isPending,  startTransition] = useTransition();
  const [showAdd,    setShowAdd]   = useState(false);
  const [editingId,  setEditingId] = useState<string | null>(null);

  // Add-member form state
  const [addForm, setAddForm] = useState({ name: "", initials: "", whatsapp: "" });

  async function refresh() {
    const updated = await getTeamMembers();
    setMembers(updated);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.initials.trim()) return;
    startTransition(async () => {
      await createTeamMember(
        addForm.name.trim(),
        addForm.initials.trim().toUpperCase(),
        addForm.whatsapp.trim() || undefined
      );
      setAddForm({ name: "", initials: "", whatsapp: "" });
      setShowAdd(false);
      await refresh();
    });
  }

  async function handleSave(id: string, name: string, initials: string) {
    startTransition(async () => {
      const res = await fetch(`/api/team/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, initials }),
      });
      if (res.ok) {
        setEditingId(null);
        await refresh();
      }
    });
  }

  const activeMembers   = members.filter(m => m.isActive);
  const inactiveMembers = members.filter(m => !m.isActive);

  const rowBorder = "1px solid var(--border-ghost)";

  // Fade in/out variants for display ↔ edit switch
  const slideIn  = { opacity: 0, y: -6 };
  const visible  = { opacity: 1, y: 0 };
  const slideOut = { opacity: 0, y: 6 };
  const rowTrans = { duration: 0.16, ease: [0, 0, 0.2, 1] as const };

  return (
    <div className="space-y-8">

      {/* ── Add member panel ──────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              background:   "var(--bg-surface)",
              border:       "1px solid var(--border-ghost)",
              borderRadius: 12,
              boxShadow:    "var(--shadow-sm)",
              padding:      24,
            }}>
              {/* Live preview */}
              <div className="flex items-center gap-3 mb-6">
                <Avatar initials={addForm.initials || "?"} />
                <div>
                  <p style={{ fontFamily: "var(--font-instrument-sans)", fontWeight: 500, fontSize: 15, color: "var(--text-primary)" }}>
                    {addForm.name || "New Member"}
                  </p>
                  <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {addForm.initials || "—"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleAdd}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <FieldInput label="Full Name"  value={addForm.name}    onChange={v => setAddForm({ ...addForm, name: v })}    placeholder="e.g. Dinesh K" autoFocus required />
                  <FieldInput label="Initials"   value={addForm.initials} onChange={v => setAddForm({ ...addForm, initials: v.toUpperCase() })} placeholder="DK" maxLength={4} required />
                  <div className="sm:col-span-2">
                    <label style={fieldLabelStyle}>WhatsApp (optional)</label>
                    <div style={{ position: "relative" }}>
                      <Phone size={12} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                      <input
                        type="tel"
                        value={addForm.whatsapp}
                        onChange={e => setAddForm({ ...addForm, whatsapp: e.target.value })}
                        placeholder="+91 9876543210"
                        style={{
                          display:      "block",
                          width:        "100%",
                          height:       40,
                          background:   "var(--bg-ground)",
                          border:       "1.5px solid var(--border-subtle)",
                          borderRadius: 8,
                          outline:      "none",
                          color:        "var(--text-primary)",
                          fontFamily:   "var(--font-instrument-sans)",
                          fontSize:     14,
                          padding:      "0 12px 0 32px",
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <motion.button type="submit" disabled={isPending} whileTap={{ scale: 0.97 }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "0 18px", height: 38,
                      background: "var(--bg-ink)", color: "var(--text-on-dark)",
                      border: "none", borderRadius: 8,
                      fontSize: 13, fontFamily: "var(--font-instrument-sans)", fontWeight: 500,
                      cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.65 : 1,
                      boxShadow: "var(--shadow-sm)",
                    }}>
                    <Check size={14} strokeWidth={2} /> Save Member
                  </motion.button>
                  <button type="button" onClick={() => setShowAdd(false)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "0 14px", height: 38,
                      background: "transparent", color: "var(--text-secondary)",
                      border: "1.5px solid var(--border-medium)", borderRadius: 8,
                      fontSize: 13, fontFamily: "var(--font-instrument-sans)", fontWeight: 500,
                      cursor: "pointer",
                    }}>
                    <X size={14} strokeWidth={2} /> Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active members ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Team Members</SectionLabel>
          {!showAdd && (
            <motion.button
              onClick={() => setShowAdd(true)}
              whileTap={{ scale: 0.97 }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "0 14px", height: 34,
                background: "var(--bg-ink)", color: "var(--text-on-dark)",
                border: "none", borderRadius: 8,
                fontSize: 13, fontFamily: "var(--font-instrument-sans)", fontWeight: 500,
                cursor: "pointer", boxShadow: "var(--shadow-sm)",
              }}
            >
              <Plus size={13} strokeWidth={2} /> Add Member
            </motion.button>
          )}
        </div>

        <div style={{
          background:   "var(--bg-surface)",
          border:       "1px solid var(--border-ghost)",
          borderRadius: 12,
          boxShadow:    "var(--shadow-sm)",
          overflow:     "hidden",
        }}>
          <AnimatePresence initial={false}>
            {activeMembers.map((member) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ borderBottom: rowBorder }}
              >
                {/* Display ↔ Edit toggle with AnimatePresence */}
                <AnimatePresence mode="wait" initial={false}>
                  {editingId === member.id ? (
                    <motion.div
                      key="edit"
                      initial={slideIn}
                      animate={visible}
                      exit={slideOut}
                      transition={rowTrans}
                    >
                      <EditRow
                        member={member}
                        onSave={(name, initials) => handleSave(member.id, name, initials)}
                        onCancel={() => setEditingId(null)}
                        isPending={isPending}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="display"
                      initial={slideIn}
                      animate={visible}
                      exit={slideOut}
                      transition={rowTrans}
                    >
                      <DisplayRow
                        member={member}
                        onEdit={() => setEditingId(member.id)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>

          {activeMembers.length === 0 && (
            <div style={{ padding: "40px 24px", textAlign: "center", fontSize: 14, color: "var(--text-muted)", fontStyle: "italic", fontFamily: "var(--font-instrument-sans)" }}>
              No team members yet
            </div>
          )}
        </div>
      </section>

      {/* ── Inactive members ───────────────────────────────────────────── */}
      {inactiveMembers.length > 0 && (
        <section>
          <SectionLabel>Inactive</SectionLabel>
          <div style={{
            background:   "var(--bg-surface)",
            border:       "1px solid var(--border-ghost)",
            borderRadius: 12,
            overflow:     "hidden",
            marginTop:    12,
            opacity:      0.65,
          }}>
            {inactiveMembers.map((member, i) => (
              <div
                key={member.id}
                style={{
                  borderBottom: i < inactiveMembers.length - 1 ? rowBorder : undefined,
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {editingId === member.id ? (
                    <motion.div
                      key="edit"
                      initial={slideIn}
                      animate={visible}
                      exit={slideOut}
                      transition={rowTrans}
                    >
                      <EditRow
                        member={member}
                        onSave={(name, initials) => handleSave(member.id, name, initials)}
                        onCancel={() => setEditingId(null)}
                        isPending={isPending}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="display"
                      initial={slideIn}
                      animate={visible}
                      exit={slideOut}
                      transition={rowTrans}
                    >
                      <DisplayRow
                        member={member}
                        onEdit={() => setEditingId(member.id)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
