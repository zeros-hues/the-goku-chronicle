"use client";

import { motion } from "framer-motion";

interface PillColors {
  bg: string;
  text: string;
  border: string;
}

export function getClientColors(clientName: string): PillColors {
  const n = clientName.toLowerCase();

  if (n.includes("appasamy")) {
    return { bg: "#E8EEF8", text: "#1E3A6E", border: "#C4D0E8" };
  }

  if (n.includes("goku") || n === "internal" || n === "goku studio") {
    return { bg: "#EDE8DF", text: "#4A3C2E", border: "#D4C9B8" };
  }

  const hash = clientName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const palette: PillColors[] = [
    { bg: "#E8F0EC", text: "#1E4A32", border: "#C4DDD0" },
    { bg: "#F5EDE8", text: "#5C2E1A", border: "#E0C8BC" },
    { bg: "#E8EDF5", text: "#1A2E50", border: "#C4CDE0" },
    { bg: "#F5EDF5", text: "#4A1E5C", border: "#D4C0E0" },
  ];
  return palette[hash % palette.length];
}

interface ProjectPillProps {
  projectName: string;
  clientName: string;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}

export function ProjectPill({
  projectName, clientName, selected, dimmed, onClick, size = "md",
}: ProjectPillProps) {
  const colors = getClientColors(clientName);
  const isInteractive = onClick !== undefined;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={isInteractive ? { y: -1, boxShadow: "var(--shadow-sm)" } as never : undefined}
      transition={{ duration: 0.12, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        height:       size === "sm" ? 22 : 24,
        padding:      "0 10px",
        borderRadius: 6,
        fontFamily:   "var(--font-martian-mono)",
        fontSize:     11,
        fontWeight:   500,
        whiteSpace:   "nowrap",
        cursor:       isInteractive ? "pointer" : "default",
        border:       `1.5px solid ${(selected !== undefined && !selected) ? colors.border : colors.border}`,
        background:   (selected !== undefined && !selected) ? "transparent" : colors.bg,
        color:        colors.text,
        opacity:      dimmed ? 0.50 : 1,
        transition:   "opacity 150ms ease, transform 120ms ease-out",
      }}
    >
      {projectName}
    </motion.button>
  );
}

/** Plain span — used in table rows, no button behaviour */
export function ProjectPillStatic({
  projectName, clientName,
}: { projectName: string; clientName: string }) {
  const colors = getClientColors(clientName);
  return (
    <motion.span
      whileHover={{ y: -1, boxShadow: "var(--shadow-sm)" } as never}
      transition={{ duration: 0.12, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        height:       24,
        padding:      "0 10px",
        borderRadius: 6,
        fontFamily:   "var(--font-martian-mono)",
        fontSize:     11,
        fontWeight:   500,
        whiteSpace:   "nowrap",
        background:   colors.bg,
        color:        colors.text,
        border:       `1.5px solid ${colors.border}`,
      }}
    >
      {projectName}
    </motion.span>
  );
}
