"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { RotateCcw, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import PageMotion from "@/components/PageMotion";
import SectionLabel from "@/components/SectionLabel";
import {
  getTrashedEntries,
  restoreEntry,
  permanentlyDeleteEntry,
} from "@/app/actions/entries";

type Entry = {
  id: string;
  date: Date;
  project: { name: string; client: { name: string; id: string } } | null;
  taskDescription: string;
  isMeeting: boolean;
  personCount: number | null;
  meetingDuration: number | null;
  deletedAt: Date | null;
  taskHours: Array<{ hours: number; teamMember: { initials: string } }>;
};

function entryTotal(e: Entry) {
  if (e.isMeeting) return e.meetingDuration ?? 0;
  return e.taskHours.reduce((s, th) => s + th.hours, 0);
}

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <motion.button
      onClick={onChange}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        border: `2px solid ${checked ? "var(--action-primary)" : "var(--border)"}`,
        background: checked ? "var(--action-primary)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 150ms, border-color 150ms",
      }}
    >
      <AnimatePresence>
        {checked && (
          <motion.svg
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            width="10"
            height="8"
            viewBox="0 0 10 8"
            fill="none"
          >
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="var(--action-primary-text)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export default function TrashPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | "bulk" | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getTrashedEntries();
    setEntries(data as unknown as Entry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.id)));
    }
  }

  async function handleRestore(id: string) {
    setBusyIds((prev) => new Set(Array.from(prev).concat(id)));
    await restoreEntry(id);
    await load();
    setBusyIds((prev) => { const n = new Set(Array.from(prev)); n.delete(id); return n; });
  }

  async function handleBulkRestore() {
    for (const id of Array.from(selected)) {
      await restoreEntry(id);
    }
    setSelected(new Set());
    await load();
  }

  async function confirmDelete(target: string | "bulk") {
    if (target === "bulk") {
      for (const id of Array.from(selected)) {
        await permanentlyDeleteEntry(id);
      }
      setSelected(new Set());
    } else {
      await permanentlyDeleteEntry(target);
    }
    setDeleteTarget(null);
    await load();
  }

  const allSelected = entries.length > 0 && selected.size === entries.length;

  return (
    <PageMotion>
      <div className="p-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p
              style={{
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 8,
              }}
            >
              Chronicle
            </p>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
              }}
            >
              Trash
            </h1>
          </div>

          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 mt-2"
              >
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--font-geist-mono, monospace)",
                    color: "var(--text-muted)",
                  }}
                >
                  {selected.size} selected
                </span>
                <motion.button
                  onClick={handleBulkRestore}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    border: "1px solid var(--border)",
                    background: "var(--card-bg)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    fontFamily: "var(--font-geist-sans, sans-serif)",
                  }}
                >
                  <RotateCcw size={12} />
                  Restore All
                </motion.button>
                <motion.button
                  onClick={() => setDeleteTarget("bulk")}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    border: "1px solid var(--destructive)",
                    background: "transparent",
                    color: "var(--destructive)",
                    cursor: "pointer",
                    fontFamily: "var(--font-geist-sans, sans-serif)",
                  }}
                >
                  <Trash2 size={12} />
                  Delete All
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content */}
        {loading ? (
          <section>
            <SectionLabel>Deleted Entries</SectionLabel>
            <div
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
                padding: 24,
              }}
            >
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} style={{ height: 44, borderRadius: 6 }} />
                ))}
              </div>
            </div>
          </section>
        ) : entries.length === 0 ? (
          <section>
            <SectionLabel>Deleted Entries</SectionLabel>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "64px 24px",
                textAlign: "center",
              }}
            >
              <Trash2
                size={36}
                style={{ margin: "0 auto 12px", color: "var(--border)" }}
              />
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                Trash is empty
              </p>
            </motion.div>
          </section>
        ) : (
          <section>
            <SectionLabel>
              Deleted Entries
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                {" "}— {entries.length}
              </span>
            </SectionLabel>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "10px 16px", width: 44 }}>
                      <Checkbox checked={allSelected} onChange={toggleAll} />
                    </th>
                    {["Date", "Project", "Task", "Hours", "Deleted"].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 16px",
                          textAlign: i >= 3 ? "right" : "left",
                          fontFamily: "var(--font-geist-mono, monospace)",
                          fontSize: 10,
                          fontWeight: 500,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "var(--text-muted)",
                          background: "var(--surface)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                    <th style={{ width: 160, background: "var(--surface)" }} />
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {entries.map((entry, i) => (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8, height: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: selected.has(entry.id)
                            ? "color-mix(in srgb, var(--action-primary) 5%, transparent)"
                            : undefined,
                        }}
                      >
                        <td style={{ padding: "12px 16px" }}>
                          <Checkbox
                            checked={selected.has(entry.id)}
                            onChange={() => toggleSelect(entry.id)}
                          />
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            color: "var(--text-primary)",
                            fontFamily: "var(--font-geist-mono, monospace)",
                            fontSize: 12,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {format(new Date(entry.date), "dd MMM yyyy")}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
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
                        <td
                          style={{
                            padding: "12px 16px",
                            color: "var(--text-secondary)",
                            maxWidth: 300,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {entry.taskDescription}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            color: "var(--text-primary)",
                            fontFamily: "var(--font-geist-mono, monospace)",
                            fontWeight: 600,
                          }}
                        >
                          {entryTotal(entry)}h
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            color: "var(--text-muted)",
                            fontFamily: "var(--font-geist-mono, monospace)",
                            fontSize: 11,
                          }}
                        >
                          {entry.deletedAt
                            ? format(new Date(entry.deletedAt), "dd MMM")
                            : "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div className="flex items-center gap-2 justify-end">
                            <motion.button
                              onClick={() => handleRestore(entry.id)}
                              disabled={busyIds.has(entry.id)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "5px 12px",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                border: "1px solid var(--border)",
                                background: "var(--card-bg)",
                                color: "var(--text-primary)",
                                cursor: "pointer",
                                fontFamily: "var(--font-geist-sans, sans-serif)",
                                opacity: busyIds.has(entry.id) ? 0.5 : 1,
                              }}
                            >
                              <RotateCcw size={11} />
                              Restore
                            </motion.button>
                            <motion.button
                              onClick={() => setDeleteTarget(entry.id)}
                              whileHover={{ scale: 1.05, color: "var(--destructive)" }}
                              whileTap={{ scale: 0.95 }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "5px 12px",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                border: "1px solid transparent",
                                background: "transparent",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                                fontFamily: "var(--font-geist-sans, sans-serif)",
                              }}
                            >
                              <Trash2 size={11} />
                              Delete
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </motion.div>
          </section>
        )}

        {/* Delete confirm dialog */}
        <AnimatePresence>
          {deleteTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                zIndex: 50,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
              }}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: 28,
                  maxWidth: 400,
                  width: "100%",
                  boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: "color-mix(in srgb, var(--destructive) 12%, transparent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <Trash2 size={18} style={{ color: "var(--destructive)" }} />
                </div>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 8,
                  }}
                >
                  Permanently delete?
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                    marginBottom: 24,
                  }}
                >
                  {deleteTarget === "bulk"
                    ? `This will permanently delete ${selected.size} ${selected.size === 1 ? "entry" : "entries"}. This action cannot be undone.`
                    : "This will permanently delete this entry. This action cannot be undone."}
                </p>
                <div className="flex gap-3">
                  <motion.button
                    onClick={() => confirmDelete(deleteTarget)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      background: "var(--destructive)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "var(--font-geist-sans, sans-serif)",
                    }}
                  >
                    Delete Permanently
                  </motion.button>
                  <motion.button
                    onClick={() => setDeleteTarget(null)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "var(--font-geist-sans, sans-serif)",
                    }}
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageMotion>
  );
}
