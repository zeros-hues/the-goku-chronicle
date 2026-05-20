"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, X, Check, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import SectionLabel from "@/components/SectionLabel";
import {
  createTeamMember,
  updateTeamMember,
  getTeamMembers,
} from "@/app/actions/team";

type Member = {
  id: string;
  name: string;
  initials: string;
  whatsappNumber: string | null;
  isActive: boolean;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--border)",
  outline: "none",
  padding: "6px 0",
  fontSize: 13,
  color: "var(--text-primary)",
  fontFamily: "var(--font-geist-sans, sans-serif)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-geist-mono, monospace)",
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: "var(--text-muted)",
  marginBottom: 4,
};

function Avatar({ initials, isActive = true }: { initials: string; isActive?: boolean }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        background: isActive ? "var(--action-primary)" : "var(--surface)",
        color: isActive ? "var(--action-primary-text)" : "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "var(--font-geist-mono, monospace)",
        flexShrink: 0,
        border: "1px solid var(--border)",
      }}
    >
      {initials || "?"}
    </div>
  );
}

export default function TeamClient({
  initialMembers,
}: {
  initialMembers: Member[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);

  const [form, setForm] = useState({ name: "", initials: "", whatsapp: "" });
  const [editForm, setEditForm] = useState({
    name: "",
    initials: "",
    whatsapp: "",
    isActive: true,
  });

  async function refresh() {
    const updated = await getTeamMembers();
    setMembers(updated);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.initials.trim()) return;
    startTransition(async () => {
      await createTeamMember(
        form.name.trim(),
        form.initials.trim().toUpperCase(),
        form.whatsapp.trim() || undefined
      );
      setForm({ name: "", initials: "", whatsapp: "" });
      setShowAdd(false);
      await refresh();
    });
  }

  function openEdit(member: Member) {
    setEditMember(member);
    setEditForm({
      name: member.name,
      initials: member.initials,
      whatsapp: member.whatsappNumber || "",
      isActive: member.isActive,
    });
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editMember || !editForm.name.trim() || !editForm.initials.trim()) return;
    startTransition(async () => {
      await updateTeamMember(
        editMember.id,
        editForm.name.trim(),
        editForm.initials.trim().toUpperCase(),
        editForm.whatsapp.trim() || undefined,
        editForm.isActive
      );
      setEditMember(null);
      await refresh();
    });
  }

  const activeMembers = members.filter((m) => m.isActive);
  const inactiveMembers = members.filter((m) => !m.isActive);

  return (
    <div className="space-y-8">
      {/* Add member form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 24,
              }}
            >
              {/* Preview avatar */}
              <div className="flex items-center gap-4 mb-6">
                <Avatar initials={form.initials || "?"} />
                <div>
                  <p style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>
                    {form.name || "New Member"}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-geist-mono, monospace)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {form.initials || "—"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleAdd}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label style={labelStyle}>Full Name</label>
                    <input
                      autoFocus
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      style={inputStyle}
                      placeholder="e.g. Dinesh K"
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Initials</label>
                    <input
                      type="text"
                      value={form.initials}
                      onChange={(e) => setForm({ ...form, initials: e.target.value.toUpperCase() })}
                      style={inputStyle}
                      placeholder="e.g. DK"
                      maxLength={4}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label style={labelStyle}>WhatsApp (optional)</label>
                    <div style={{ position: "relative" }}>
                      <Phone size={12} style={{ position: "absolute", left: 0, top: 10, color: "var(--text-muted)" }} />
                      <input
                        type="tel"
                        value={form.whatsapp}
                        onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                        style={{ ...inputStyle, paddingLeft: 20 }}
                        placeholder="+91 9876543210"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <motion.button
                    type="submit"
                    disabled={isPending}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 20px",
                      background: "var(--action-primary)",
                      color: "var(--action-primary-text)",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: isPending ? "not-allowed" : "pointer",
                      opacity: isPending ? 0.6 : 1,
                      fontFamily: "var(--font-geist-sans, sans-serif)",
                    }}
                  >
                    <Check size={14} /> Save Member
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 16px",
                      background: "transparent",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "var(--font-geist-sans, sans-serif)",
                    }}
                  >
                    <X size={14} /> Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active members */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <SectionLabel>Team Members</SectionLabel>
          {!showAdd && (
            <motion.button
              onClick={() => setShowAdd(true)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                background: "var(--action-primary)",
                color: "var(--action-primary-text)",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-geist-sans, sans-serif)",
                marginTop: -4,
              }}
            >
              <Plus size={12} /> Add Member
            </motion.button>
          )}
        </div>

        <motion.div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <AnimatePresence initial={false}>
            {activeMembers.map((member, i) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                style={{ borderBottom: "1px solid var(--border)" }}
                className="group"
              >
                {editMember?.id === member.id ? (
                  <form onSubmit={handleUpdate} style={{ padding: "20px 20px" }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label style={labelStyle}>Name</label>
                        <input
                          autoFocus
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          style={inputStyle}
                          required
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Initials</label>
                        <input
                          type="text"
                          value={editForm.initials}
                          onChange={(e) =>
                            setEditForm({ ...editForm, initials: e.target.value.toUpperCase() })
                          }
                          style={inputStyle}
                          maxLength={4}
                          required
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>WhatsApp</label>
                        <input
                          type="tel"
                          value={editForm.whatsapp}
                          onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                      <div className="flex items-center gap-3 pt-4">
                        <Switch
                          id={`active-${member.id}`}
                          checked={editForm.isActive}
                          onCheckedChange={(v) => setEditForm({ ...editForm, isActive: v })}
                        />
                        <label htmlFor={`active-${member.id}`} style={{ fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}>
                          Active
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <motion.button
                        type="submit"
                        disabled={isPending}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 16px",
                          background: "var(--action-primary)",
                          color: "var(--action-primary-text)",
                          border: "none",
                          borderRadius: 7,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: isPending ? "not-allowed" : "pointer",
                          fontFamily: "var(--font-geist-sans, sans-serif)",
                        }}
                      >
                        <Check size={13} /> Save
                      </motion.button>
                      <button
                        type="button"
                        onClick={() => setEditMember(null)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 14px",
                          background: "transparent",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border)",
                          borderRadius: 7,
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "var(--font-geist-sans, sans-serif)",
                        }}
                      >
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div
                    style={{
                      padding: "14px 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar initials={member.initials} />
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                          {member.name}
                        </p>
                        {member.whatsappNumber && (
                          <p
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              marginTop: 2,
                            }}
                          >
                            <Phone size={9} />
                            {member.whatsappNumber}
                          </p>
                        )}
                      </div>
                    </div>
                    <motion.button
                      onClick={() => openEdit(member)}
                      whileHover={{ rotate: -10, scale: 1.1 }}
                      style={{
                        width: 32,
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 6,
                        background: "transparent",
                        color: "var(--text-muted)",
                        border: "none",
                        cursor: "pointer",
                        opacity: 0,
                      }}
                      className="group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil size={14} />
                    </motion.button>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {members.length === 0 && (
            <div
              style={{
                padding: "40px 24px",
                textAlign: "center",
                fontSize: 14,
                color: "var(--text-muted)",
                fontStyle: "italic",
              }}
            >
              No team members yet
            </div>
          )}
        </motion.div>
      </section>

      {/* Inactive members */}
      {inactiveMembers.length > 0 && (
        <section>
          <SectionLabel>Inactive</SectionLabel>
          <motion.div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {inactiveMembers.map((member, i) => (
              <div
                key={member.id}
                style={{
                  padding: "14px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: i < inactiveMembers.length - 1 ? "1px solid var(--border)" : undefined,
                  opacity: 0.55,
                }}
                className="group"
              >
                <div className="flex items-center gap-4">
                  <Avatar initials={member.initials} isActive={false} />
                  <p style={{ fontWeight: 500, fontSize: 14, color: "var(--text-secondary)" }}>
                    {member.name}
                  </p>
                </div>
                <motion.button
                  onClick={() => openEdit(member)}
                  whileHover={{ scale: 1.1 }}
                  style={{
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 6,
                    background: "transparent",
                    color: "var(--text-muted)",
                    border: "none",
                    cursor: "pointer",
                    opacity: 0,
                  }}
                  className="group-hover:opacity-100 transition-opacity"
                >
                  <Pencil size={14} />
                </motion.button>
              </div>
            ))}
          </motion.div>
        </section>
      )}
    </div>
  );
}
