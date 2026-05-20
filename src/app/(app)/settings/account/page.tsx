"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PageMotion from "@/components/PageMotion";
import SectionLabel from "@/components/SectionLabel";
import { changePassword } from "@/app/actions/auth";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--border)",
  outline: "none",
  padding: "8px 0",
  fontSize: 14,
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
  marginBottom: 6,
};

export default function AccountPage() {
  const [showDefault, setShowDefault] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPw !== confirmPw) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }
    if (newPw.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }

    setLoading(true);
    const result = await changePassword(currentPw, newPw);
    setLoading(false);

    if (result.success) {
      setMessage({ type: "success", text: "Password changed successfully" });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } else {
      setMessage({ type: "error", text: result.error || "Failed to change password" });
    }
  }

  return (
    <PageMotion>
      <div className="p-6 max-w-xl">
        <div className="mb-8">
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
            Settings
          </p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            Account
          </h1>
        </div>

        {/* Default credentials */}
        <section className="mb-8">
          <SectionLabel>Default Credentials</SectionLabel>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "var(--surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <KeyRound size={16} style={{ color: "var(--text-secondary)" }} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  Setup Password
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Username: <span style={{ fontFamily: "var(--font-geist-mono, monospace)" }}>admin</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                style={{
                  flex: 1,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 16px",
                  fontFamily: "var(--font-geist-mono, monospace)",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  letterSpacing: showDefault ? "0.05em" : "0.2em",
                }}
              >
                {showDefault ? "goku2026" : "••••••••"}
              </div>
              <motion.button
                onClick={() => setShowDefault(!showDefault)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 16px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "1px solid var(--border)",
                  background: "var(--card-bg)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontFamily: "var(--font-geist-sans, sans-serif)",
                  whiteSpace: "nowrap",
                }}
              >
                {showDefault ? <EyeOff size={13} /> : <Eye size={13} />}
                {showDefault ? "Hide" : "Reveal"}
              </motion.button>
            </div>
          </motion.div>
        </section>

        {/* Change password */}
        <section>
          <SectionLabel>Change Password</SectionLabel>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.08 }}
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div>
                <label style={labelStyle}>Current Password</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>New Password</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  style={inputStyle}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label style={labelStyle}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 14px",
                      borderRadius: 8,
                      background:
                        message.type === "success"
                          ? "color-mix(in srgb, #22c55e 10%, transparent)"
                          : "color-mix(in srgb, var(--destructive) 10%, transparent)",
                      border: `1px solid ${message.type === "success" ? "#22c55e" : "var(--destructive)"}`,
                    }}
                  >
                    {message.type === "success" && <ShieldCheck size={14} style={{ color: "#22c55e", flexShrink: 0 }} />}
                    <p
                      style={{
                        fontSize: 13,
                        color: message.type === "success" ? "#16a34a" : "var(--destructive)",
                      }}
                    >
                      {message.text}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                style={{
                  width: "100%",
                  padding: "11px 0",
                  background: "var(--action-primary)",
                  color: "var(--action-primary-text)",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  fontFamily: "var(--font-geist-sans, sans-serif)",
                  letterSpacing: "0.01em",
                }}
              >
                {loading ? "Updating..." : "Update Password"}
              </motion.button>
            </form>
          </motion.div>
        </section>
      </div>
    </PageMotion>
  );
}
