"use client";

import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import EntryForm from "@/components/EntryForm";
import { BillingType } from "@prisma/client";

type Member = { id: string; name: string; initials: string; isActive: boolean };
type Project = {
  id: string;
  name: string;
  billingType: BillingType;
  archivedAt: Date | null;
};
type Client = {
  id: string;
  name: string;
  hasRetainership: boolean;
  projects: Project[];
  createdAt: Date;
};
type Entry = {
  id: string;
  date: Date;
  projectId: string | null;
  taskDescription: string;
  isMeeting: boolean;
  personCount: number | null;
  meetingDuration: number | null;
  billingOverride: BillingType | null;
  taskHours: Array<{ teamMemberId: string; hours: number }>;
};

export default function EditEntryModal({
  entry,
  clients,
  members,
  onClose,
  onSaved,
}: {
  entry: Entry;
  clients: Client[];
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 50,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 64,
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        <motion.div
          initial={{ scale: 0.97, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 8 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            width: "100%",
            maxWidth: 680,
            maxHeight: "80vh",
            overflowY: "auto",
            boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 24px",
              borderBottom: "1px solid var(--border)",
              position: "sticky",
              top: 0,
              background: "var(--card-bg)",
              zIndex: 1,
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: "var(--font-geist-mono, monospace)",
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 2,
                }}
              >
                Chronicle
              </p>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                }}
              >
                Edit Entry
              </h2>
            </div>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.15 }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              <X size={15} />
            </motion.button>
          </div>

          {/* Form */}
          <div style={{ padding: "24px" }}>
            <EntryForm
              clients={clients as never}
              members={members}
              existing={{
                ...entry,
                date: new Date(entry.date),
                taskHours: entry.taskHours.map((th) => ({
                  teamMemberId: th.teamMemberId,
                  hours: th.hours,
                })),
              }}
              onSuccess={onSaved}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
