"use client";

import { X } from "lucide-react";
import EntryForm from "@/components/EntryForm";
import { BillingType } from "@prisma/client";
import { Sheet, SheetContent } from "@/components/ui/sheet";

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
    <Sheet open={true} onOpenChange={(open: boolean) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="p-0 gap-0"
        style={{
          width: 480,
          maxWidth: 480,
          backgroundColor: "var(--bg-overlay)",
          background: "var(--bg-overlay)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-8px 0 40px rgba(42, 31, 20, 0.10)",
          display: "flex",
          flexDirection: "column",
          zIndex: 50,
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
            flexShrink: 0,
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
          <button
            onClick={onClose}
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
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
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
      </SheetContent>
    </Sheet>
  );
}
