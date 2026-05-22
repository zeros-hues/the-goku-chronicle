"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, FileJson, X, AlertCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, parse, isValid } from "date-fns";
import type { ParsedImportEntry } from "@/app/api/import/route";

type PreviewRow = ParsedImportEntry & { status: "new" | "duplicate" | "error"; errorMsg?: string };

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  existingKeys: Set<string>; // "date|projectName|task" for duplicate detection
}

// ─── Excel parser ─────────────────────────────────────────────────────────────

async function parseExcel(file: File): Promise<ParsedImportEntry[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];

  if (rows.length < 2) return [];

  // Detect header row — find the row containing "Date" or "Project"
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i] as string[];
    if (row.some((c) => typeof c === "string" && /date/i.test(c))) {
      headerIdx = i;
      break;
    }
  }

  const headers = (rows[headerIdx] as string[]).map((h) => String(h ?? "").trim().toLowerCase());

  // Known member column patterns
  const memberCols: Array<{ idx: number; name: string }> = [];
  headers.forEach((h, i) => {
    if (["date", "day", "project", "task", "total", "description", ""].includes(h)) return;
    memberCols.push({ idx: i, name: h });
  });

  const dateIdx    = headers.findIndex((h) => h === "date");
  const projectIdx = headers.findIndex((h) => h === "project");
  const taskIdx    = headers.findIndex((h) => ["task", "description", "task description"].includes(h));

  const entries: ParsedImportEntry[] = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] as (string | number)[];

    const rawDate = row[dateIdx];
    if (!rawDate && rawDate !== 0) continue;

    const rawTask = String(row[taskIdx] ?? "").trim();
    if (!rawTask || /total/i.test(rawTask)) continue;

    // Parse date: Excel serial or string
    let dateStr = "";
    if (typeof rawDate === "number") {
      const jsDate = new Date((rawDate - 25569) * 86400 * 1000);
      dateStr = format(jsDate, "yyyy-MM-dd");
    } else {
      const raw = String(rawDate).trim();
      // Try DD/MM/YYYY
      const d1 = parse(raw, "dd/MM/yyyy", new Date());
      if (isValid(d1)) { dateStr = format(d1, "yyyy-MM-dd"); }
      else {
        const d2 = parse(raw, "yyyy-MM-dd", new Date());
        if (isValid(d2)) { dateStr = format(d2, "yyyy-MM-dd"); }
        else {
          const d3 = new Date(raw);
          if (isValid(d3)) dateStr = format(d3, "yyyy-MM-dd");
        }
      }
    }
    if (!dateStr) continue;

    const projectName = projectIdx >= 0 ? String(row[projectIdx] ?? "").trim() || null : null;

    const hours: Array<{ memberName: string; hours: number }> = [];
    for (const mc of memberCols) {
      const val = parseFloat(String(row[mc.idx] ?? "0"));
      if (val > 0) hours.push({ memberName: mc.name, hours: val });
    }

    entries.push({
      date: dateStr,
      projectName,
      clientName: null,
      taskDescription: rawTask,
      isMeeting: false,
      hours,
    });
  }

  return entries;
}

// ─── JSON parser ─────────────────────────────────────────────────────────────

function parseJSON(text: string): ParsedImportEntry[] {
  const data = JSON.parse(text);
  const rawEntries = Array.isArray(data) ? data : data.entries ?? [];
  return rawEntries.map((e: Record<string, unknown>) => ({
    date: String(e.date ?? ""),
    projectName: (e.project as string) ?? null,
    clientName: (e.client as string) ?? null,
    taskDescription: (e.task as string) ?? "",
    isMeeting: Boolean(e.isMeeting),
    personCount: (e.personCount as number) ?? undefined,
    meetingDuration: (e.meetingDuration as number) ?? undefined,
    hours: ((e.hours ?? []) as Array<{ member: string; hours: number }>).map((h) => ({
      memberName: h.member,
      hours: h.hours,
    })),
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportDialog({ open, onClose, onImported, existingKeys }: ImportDialogProps) {
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<PreviewRow[]>([]);
  const [parsing, setParsing]     = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (f: File) => {
    setFile(f);
    setParsing(true);
    try {
      let entries: ParsedImportEntry[];
      if (f.name.endsWith(".json")) {
        entries = parseJSON(await f.text());
      } else {
        entries = await parseExcel(f);
      }

      const rows: PreviewRow[] = entries.map((e) => {
        const key = `${e.date}|${(e.projectName ?? "").toLowerCase()}|${e.taskDescription.toLowerCase()}`;
        return { ...e, status: existingKeys.has(key) ? "duplicate" : "new" };
      });
      setPreview(rows);
    } catch {
      toast.error("Failed to parse file. Check the format and try again.");
    } finally {
      setParsing(false);
    }
  }, [existingKeys]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }

  async function handleImport(skipDuplicates: boolean) {
    const toImport = skipDuplicates ? preview.filter((r) => r.status === "new") : preview;
    if (toImport.length === 0) { toast.error("Nothing to import."); return; }

    setImporting(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: toImport, skipDuplicates }),
      });
      const data = await res.json() as { imported: number; skipped: number; errors: string[] };
      toast.success(`Imported ${data.imported} entries${data.skipped > 0 ? `, skipped ${data.skipped} duplicates` : ""}`);
      if (data.errors.length > 0) toast.error(`${data.errors.length} errors: ${data.errors[0]}`);
      onImported();
      onClose();
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  const newCount = preview.filter((r) => r.status === "new").length;
  const isJson   = file?.name.endsWith(".json");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[640px] p-0 gap-0 overflow-hidden"
        style={{ background: "var(--bg-overlay)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 10, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 2 }}>
              Chronicle
            </p>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
              Import Entries
            </h2>
            <p style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              Upload an Excel or JSON file to populate your timesheet.
            </p>
          </div>
          <button onClick={() => { reset(); onClose(); }} style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: 24, maxHeight: "70vh", overflowY: "auto" }}>
          {/* Dropzone */}
          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `1.5px dashed ${dragOver ? "var(--text-primary)" : "var(--border-medium)"}`,
                borderRadius: 12,
                padding: "48px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                background: dragOver ? "var(--bg-hover)" : "var(--bg-ground)",
                transition: "all 150ms ease",
              }}
            >
              <Upload size={28} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
              <p style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
                Drop your file here or click to browse
              </p>
              <p style={{ fontFamily: "var(--font-martian-mono)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
                .xlsx · .xls · .json
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--bg-ground)", border: "1px solid var(--border-ghost)", borderRadius: 8, marginBottom: 16 }}>
              {isJson ? <FileJson size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> : <FileSpreadsheet size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
              <span style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 13, color: "var(--text-primary)", flex: 1 }}>{file.name}</span>
              <span style={{ fontFamily: "var(--font-martian-mono)", fontSize: 11, color: "var(--text-muted)" }}>{(file.size / 1024).toFixed(1)} KB</span>
              <button onClick={reset} style={{ fontSize: 12, fontFamily: "var(--font-instrument-sans)", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Change file
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.json"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />

          {/* Preview table */}
          <AnimatePresence>
            {parsing && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontFamily: "var(--font-martian-mono)", fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
                Parsing…
              </motion.p>
            )}
            {!parsing && preview.length > 0 && (
              <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ marginTop: 16, border: "1px solid var(--border-ghost)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ maxHeight: 280, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-ground)", borderBottom: "1px solid var(--border-subtle)" }}>
                        {["Date", "Project", "Task", "Hours", "Status"].map((h) => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontFamily: "var(--font-martian-mono)", fontSize: 10, fontWeight: 500, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 50).map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-ghost)", background: row.status === "duplicate" ? "color-mix(in srgb, #F59E0B 4%, transparent)" : "transparent" }}>
                          <td style={{ padding: "8px 12px", fontFamily: "var(--font-martian-mono)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{row.date}</td>
                          <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{row.projectName ?? "Internal"}</td>
                          <td style={{ padding: "8px 12px", color: "var(--text-primary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.taskDescription}</td>
                          <td style={{ padding: "8px 12px", fontFamily: "var(--font-martian-mono)", color: "var(--text-muted)" }}>
                            {row.hours.reduce((s, h) => s + h.hours, 0)}h
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            {row.status === "new" ? (
                              <span style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px", borderRadius: 4, background: "color-mix(in srgb, #22C55E 12%, transparent)", color: "#16A34A", fontSize: 10, fontWeight: 600, fontFamily: "var(--font-martian-mono)", letterSpacing: "0.06em" }}>NEW</span>
                            ) : (
                              <span style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px", borderRadius: 4, background: "color-mix(in srgb, #F59E0B 12%, transparent)", color: "#B45309", fontSize: 10, fontWeight: 600, fontFamily: "var(--font-martian-mono)", letterSpacing: "0.06em" }}>DUP</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.length > 50 && (
                  <p style={{ padding: "8px 12px", fontFamily: "var(--font-martian-mono)", fontSize: 10, color: "var(--text-muted)", borderTop: "1px solid var(--border-ghost)" }}>
                    Showing 50 of {preview.length} rows
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Errors */}
          {!parsing && preview.length === 0 && file && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "12px 14px", background: "color-mix(in srgb, var(--color-destructive) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--color-destructive) 25%, transparent)", borderRadius: 8 }}>
              <AlertCircle size={14} style={{ color: "var(--color-destructive)", flexShrink: 0 }} />
              <p style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 13, color: "var(--color-destructive)" }}>
                No entries found. Check the file format.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {preview.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 24px", borderTop: "1px solid var(--border)" }}>
            <motion.button
              onClick={() => handleImport(true)}
              disabled={importing || newCount === 0}
              whileTap={{ scale: 0.97 }}
              style={{
                flex: 1, height: 44, background: "var(--bg-ink)", color: "var(--text-on-dark)",
                border: "none", borderRadius: 8, fontFamily: "var(--font-instrument-sans)", fontSize: 14, fontWeight: 500,
                cursor: importing || newCount === 0 ? "not-allowed" : "pointer",
                opacity: importing || newCount === 0 ? 0.5 : 1,
              }}
            >
              {importing ? "Importing…" : `Import ${newCount} ${newCount === 1 ? "entry" : "entries"}`}
            </motion.button>
            {preview.some((r) => r.status === "duplicate") && (
              <motion.button
                onClick={() => handleImport(false)}
                disabled={importing}
                whileTap={{ scale: 0.97 }}
                style={{
                  height: 44, padding: "0 16px", background: "transparent", color: "var(--text-secondary)",
                  border: "1px solid var(--border-medium)", borderRadius: 8, fontFamily: "var(--font-instrument-sans)", fontSize: 13, fontWeight: 400,
                  cursor: importing ? "not-allowed" : "pointer", whiteSpace: "nowrap",
                }}
              >
                Import all incl. duplicates
              </motion.button>
            )}
            <button
              onClick={() => { reset(); onClose(); }}
              style={{ fontFamily: "var(--font-instrument-sans)", fontSize: 13, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 8px" }}
            >
              Cancel
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
