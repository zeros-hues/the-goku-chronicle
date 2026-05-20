"use client";

import { useState, useTransition } from "react";
import { BillingType } from "@prisma/client";
import { Plus, Pencil, Archive, ArchiveRestore, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import SectionLabel from "@/components/SectionLabel";
import {
  createClient,
  createProject,
  updateProject,
  archiveProject,
  getClientsWithProjects,
} from "@/app/actions/projects";

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
};

const BILLING_LABELS: Record<BillingType, string> = {
  RETAINERSHIP: "Retainership",
  OUT_OF_RETAINERSHIP: "Out of Retainer",
  INTERNAL: "Internal",
};

const BILLING_BADGE: Record<BillingType, { bg: string; color: string }> = {
  RETAINERSHIP: { bg: "color-mix(in srgb, var(--action-primary) 12%, transparent)", color: "var(--text-primary)" },
  OUT_OF_RETAINERSHIP: { bg: "color-mix(in srgb, var(--action-primary) 6%, transparent)", color: "var(--text-secondary)" },
  INTERNAL: { bg: "var(--surface)", color: "var(--text-muted)" },
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

export default function ProjectsClient({
  initialClients,
}: {
  initialClients: Client[];
}) {
  const [clients, setClients] = useState(initialClients);
  const [isPending, startTransition] = useTransition();

  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientRetainership, setNewClientRetainership] = useState(false);

  const [showAddProject, setShowAddProject] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectBilling, setNewProjectBilling] = useState<BillingType>(BillingType.RETAINERSHIP);

  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectBilling, setEditProjectBilling] = useState<BillingType>(BillingType.RETAINERSHIP);

  async function refresh() {
    const updated = await getClientsWithProjects();
    setClients(updated as Client[]);
  }

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientName.trim()) return;
    startTransition(async () => {
      await createClient(newClientName.trim(), newClientRetainership);
      setNewClientName("");
      setNewClientRetainership(false);
      setShowAddClient(false);
      await refresh();
    });
  }

  async function handleAddProject(e: React.FormEvent, clientId: string) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    startTransition(async () => {
      await createProject(newProjectName.trim(), clientId, newProjectBilling);
      setNewProjectName("");
      setShowAddProject(null);
      await refresh();
    });
  }

  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!editProject || !editProjectName.trim()) return;
    startTransition(async () => {
      await updateProject(editProject.id, editProjectName.trim(), editProjectBilling);
      setEditProject(null);
      await refresh();
    });
  }

  async function handleArchive(id: string) {
    startTransition(async () => {
      await archiveProject(id);
      await refresh();
    });
  }

  function openEditProject(project: Project) {
    setEditProject(project);
    setEditProjectName(project.name);
    setEditProjectBilling(project.billingType);
  }

  function getBillingOptions(client: Client): BillingType[] {
    if (client.name === "Goku Studio") return [BillingType.INTERNAL];
    if (client.hasRetainership) return [BillingType.RETAINERSHIP, BillingType.OUT_OF_RETAINERSHIP];
    return [BillingType.OUT_OF_RETAINERSHIP, BillingType.INTERNAL];
  }

  return (
    <div className="space-y-8">
      {/* Add client form */}
      <AnimatePresence>
        {showAddClient && (
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
                marginBottom: 0,
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-geist-mono, monospace)",
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 20,
                }}
              >
                New Client
              </p>
              <form onSubmit={handleAddClient}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label style={labelStyle}>Client Name</label>
                    <input
                      autoFocus
                      type="text"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      style={inputStyle}
                      placeholder="e.g. Acme Corp"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-4">
                    <Switch
                      id="retainer-new"
                      checked={newClientRetainership}
                      onCheckedChange={setNewClientRetainership}
                    />
                    <label htmlFor="retainer-new" style={{ fontSize: 13, color: "var(--text-primary)", cursor: "pointer" }}>
                      Has retainership
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
                    <Check size={14} /> Save Client
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => setShowAddClient(false)}
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

      {/* Clients list */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <SectionLabel>Clients & Projects</SectionLabel>
          {!showAddClient && (
            <motion.button
              onClick={() => setShowAddClient(true)}
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
              <Plus size={12} /> Add Client
            </motion.button>
          )}
        </div>

        <div className="space-y-4">
          {clients.map((client, clientIndex) => {
            const billingOptions = getBillingOptions(client);
            const activeProjects = client.projects.filter((p) => !p.archivedAt);
            const archivedProjects = client.projects.filter((p) => p.archivedAt);
            const clientLetter = client.name[0]?.toUpperCase() ?? "?";
            const shade = ["#1A1918", "#3D3A35", "#5E5A52", "#8A857C"][clientIndex % 4];

            return (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: clientIndex * 0.06, duration: 0.25 }}
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {/* Client header */}
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: shade,
                        color: "#F5F4F0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "var(--font-geist-mono, monospace)",
                        flexShrink: 0,
                      }}
                    >
                      {clientLetter}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                        {client.name}
                      </p>
                      {client.hasRetainership && (
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-geist-mono, monospace)",
                            color: "var(--text-muted)",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                          }}
                        >
                          Retainership
                        </span>
                      )}
                    </div>
                  </div>
                  <motion.button
                    onClick={() => {
                      setShowAddProject(client.id);
                      setNewProjectName("");
                      setNewProjectBilling(billingOptions[0]);
                    }}
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
                      background: "transparent",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      fontFamily: "var(--font-geist-sans, sans-serif)",
                    }}
                  >
                    <Plus size={11} /> Add Project
                  </motion.button>
                </div>

                {/* Add project form */}
                <AnimatePresence>
                  {showAddProject === client.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        overflow: "hidden",
                        borderBottom: "1px solid var(--border)",
                        background: "var(--surface)",
                      }}
                    >
                      <form
                        onSubmit={(e) => handleAddProject(e, client.id)}
                        style={{ padding: "16px 20px", display: "flex", alignItems: "flex-end", gap: 12 }}
                      >
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>Project Name</label>
                          <input
                            autoFocus
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            style={inputStyle}
                            placeholder="e.g. Phase 2"
                            required
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Billing</label>
                          <select
                            value={newProjectBilling}
                            onChange={(e) => setNewProjectBilling(e.target.value as BillingType)}
                            style={{ ...inputStyle, width: "auto", minWidth: 140 }}
                          >
                            {billingOptions.map((b) => (
                              <option key={b} value={b}>{BILLING_LABELS[b]}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="submit"
                          disabled={isPending}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: "var(--action-primary)",
                            color: "var(--action-primary-text)",
                            border: "none",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddProject(null)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: "transparent",
                            color: "var(--text-muted)",
                            border: "1px solid var(--border)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <X size={14} />
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Projects list */}
                <div>
                  {activeProjects.map((project) => (
                    <div
                      key={project.id}
                      style={{
                        padding: "12px 20px",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                      className="group"
                    >
                      {editProject?.id === project.id ? (
                        <form onSubmit={handleUpdateProject} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <input
                              autoFocus
                              type="text"
                              value={editProjectName}
                              onChange={(e) => setEditProjectName(e.target.value)}
                              style={inputStyle}
                              required
                            />
                          </div>
                          <select
                            value={editProjectBilling}
                            onChange={(e) => setEditProjectBilling(e.target.value as BillingType)}
                            style={{ ...inputStyle, width: "auto", minWidth: 130 }}
                          >
                            {billingOptions.map((b) => (
                              <option key={b} value={b}>{BILLING_LABELS[b]}</option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              background: "var(--action-primary)",
                              color: "var(--action-primary-text)",
                              border: "none",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditProject(null)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              background: "transparent",
                              color: "var(--text-muted)",
                              border: "1px solid var(--border)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <X size={12} />
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 10px",
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 600,
                                background: shade,
                                color: "#F5F4F0",
                              }}
                            >
                              {project.name}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: "var(--font-geist-mono, monospace)",
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                padding: "2px 8px",
                                borderRadius: 4,
                                ...BILLING_BADGE[project.billingType],
                              }}
                            >
                              {BILLING_LABELS[project.billingType]}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <motion.button
                              onClick={() => openEditProject(project)}
                              whileHover={{ rotate: -10, scale: 1.1 }}
                              style={{
                                width: 28,
                                height: 28,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 6,
                                background: "transparent",
                                color: "var(--text-muted)",
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              <Pencil size={13} />
                            </motion.button>
                            <motion.button
                              onClick={() => handleArchive(project.id)}
                              whileHover={{ scale: 1.1, color: "var(--destructive)" }}
                              style={{
                                width: 28,
                                height: 28,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 6,
                                background: "transparent",
                                color: "var(--text-muted)",
                                border: "none",
                                cursor: "pointer",
                              }}
                            >
                              <Archive size={13} />
                            </motion.button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {archivedProjects.length > 0 && (
                    <details style={{ padding: "12px 20px" }}>
                      <summary
                        style={{
                          fontSize: 11,
                          fontFamily: "var(--font-geist-mono, monospace)",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          userSelect: "none",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {archivedProjects.length} archived
                      </summary>
                      {archivedProjects.map((project) => (
                        <div
                          key={project.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 0",
                            opacity: 0.5,
                          }}
                          className="group"
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 10px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 500,
                              background: "var(--surface)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {project.name}
                          </span>
                          <motion.button
                            onClick={() => handleArchive(project.id)}
                            whileHover={{ scale: 1.1 }}
                            style={{
                              width: 28,
                              height: 28,
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
                            className="group-hover:opacity-100"
                          >
                            <ArchiveRestore size={13} />
                          </motion.button>
                        </div>
                      ))}
                    </details>
                  )}

                  {activeProjects.length === 0 && archivedProjects.length === 0 && (
                    <div
                      style={{
                        padding: "16px 20px",
                        fontSize: 13,
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      No projects yet
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {clients.length === 0 && (
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                fontSize: 14,
                color: "var(--text-muted)",
                fontStyle: "italic",
              }}
            >
              No clients yet
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
