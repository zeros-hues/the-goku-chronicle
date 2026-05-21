"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { YearGrid } from "@/components/chronicle/YearGrid";

const PaperShader = dynamic(
  () => import("@/components/chronicle/PaperShader"),
  { ssr: false }
);

// ─── Stagger wrapper ──────────────────────────────────────────────────────────

function FadeUp({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

// ─── Form field — static label above, bottom-border input ────────────────────

function FormField({
  label, type, value, onChange, hasError, autoFocus,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  hasError?: boolean;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label
        style={{
          display:       "block",
          fontFamily:    "var(--font-martian-mono, 'Courier New', monospace)",
          fontSize:      10,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          color:         "var(--text-muted)",
          marginBottom:  8,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        required
        style={{
          display:      "block",
          width:        "100%",
          height:       44,
          background:   "var(--bg-ground)",
          border:       `1.5px solid ${hasError ? "var(--color-destructive)" : focused ? "var(--text-primary)" : "var(--border-subtle)"}`,
          borderRadius: 8,
          outline:      "none",
          color:        "var(--text-primary)",
          fontFamily:   "var(--font-instrument-sans, system-ui, sans-serif)",
          fontSize:     14,
          padding:      "0 14px",
          boxShadow:    focused ? "0 0 0 3px rgba(42,31,20,0.08)" : "none",
          transition:   "border-color 150ms ease, box-shadow 150ms ease",
        }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [shaking,  setShaking]  = useState(false);
  const [gridData, setGridData] = useState<Record<string, number>>({});
  const [gridYear, setGridYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetch("/api/year-grid")
      .then((r) => r.json())
      .then((d) => {
        if (d.year) setGridYear(d.year);
        if (d.days) setGridData(d.days);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid username or password");
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
    } else {
      router.push("/timesheet");
      router.refresh();
    }
  }

  const D = 0.3; // base delay — let shader warm up

  return (
    <div
      style={{
        position:   "fixed",
        inset:      0,
        overflow:   "hidden",
      }}
    >
      {/* ── Paper shader fills everything ─────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0 }}>
        <PaperShader className="w-full h-full" />
      </div>

      {/* ── Left panel — 60% — YearGrid ───────────────────────────────── */}
      <div
        className="hidden md:block"
        style={{
          position: "absolute",
          left:     0,
          top:      0,
          bottom:   0,
          width:    "60%",
        }}
      >
        {/* Centered grid canvas with padding */}
        <div
          style={{
            position:       "absolute",
            inset:          0,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            padding:        "48px",
          }}
        >
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <YearGrid
              data={gridData}
              year={gridYear}
              aria-label={`Studio work record for ${gridYear}`}
            />
          </div>
        </div>

        {/* Bottom-left wordmark overlay */}
        <div
          style={{
            position: "absolute",
            left:     48,
            bottom:   52,
            zIndex:   2,
          }}
        >
          <p
            className="font-fraunces"
            style={{
              fontVariationSettings: "'opsz' 72, 'WONK' 0",
              fontWeight:            700,
              fontSize:              48,
              lineHeight:            1,
              letterSpacing:         "-0.01em",
              color:                 "var(--text-primary)",
              opacity:               0.08,
            }}
          >
            CHRONICLE
          </p>
          <p
            style={{
              fontFamily:    "var(--font-martian-mono, 'Courier New', monospace)",
              fontSize:      10,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color:         "var(--text-secondary)",
              opacity:       0.25,
              marginTop:     6,
            }}
          >
            Goku Studio
          </p>
        </div>
      </div>

      {/* ── Right panel — 40% — login form ────────────────────────────── */}
      <div
        style={{
          position:       "absolute",
          right:          0,
          top:            0,
          bottom:         0,
          width:          "40%",
          background:     "var(--bg-surface)",
          borderLeft:     "1px solid var(--border-ghost)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
        }}
        className="md:w-[40%] w-full"
      >
        {/* Mobile: full screen with no left panel */}
        <div
          className="md:hidden absolute inset-0"
          style={{ borderLeft: "none" }}
        />

        <div
          style={{
            position:  "relative",
            zIndex:    1,
            width:     "100%",
            maxWidth:  320,
            padding:   "0 24px",
          }}
        >
          {/* Wordmark */}
          <FadeUp delay={D}>
            <p
              className="font-fraunces"
              style={{
                fontVariationSettings: "'opsz' 48, 'WONK' 0",
                fontWeight:            700,
                fontSize:              32,
                lineHeight:            "36px",
                letterSpacing:         "-0.01em",
                color:                 "var(--text-primary)",
              }}
            >
              CHRONICLE
            </p>
          </FadeUp>

          <FadeUp delay={D + 0.025}>
            <p
              style={{
                fontFamily:    "var(--font-martian-mono, 'Courier New', monospace)",
                fontSize:      11,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color:         "var(--text-secondary)",
                marginTop:     8,
              }}
            >
              Goku Studio · {gridYear}
            </p>
          </FadeUp>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            animate={shaking ? { x: [0, -6, 6, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.35, ease: "linear" }}
            style={{ marginTop: 36 }}
          >
            <FadeUp delay={D + 0.05}>
              <FormField
                label="Username"
                type="text"
                value={username}
                onChange={setUsername}
                autoFocus
              />
            </FadeUp>

            <FadeUp delay={D + 0.075}>
              <div style={{ marginTop: 28 }}>
                <FormField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  hasError={!!error}
                />
              </div>
            </FadeUp>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  style={{
                    fontFamily:    "var(--font-martian-mono, 'Courier New', monospace)",
                    fontSize:      11,
                    color:         "var(--color-destructive)",
                    marginTop:     8,
                    letterSpacing: "0.02em",
                  }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <FadeUp delay={D + 0.1}>
              <div style={{ marginTop: 28 }}>
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ opacity: 0.88 }}
                  whileTap={{ scale: 0.97, transition: { duration: 0.08 } }}
                  style={{
                    position:       "relative",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    overflow:       "hidden",
                    width:          "100%",
                    height:         48,
                    background:     "var(--bg-ink)",
                    color:          "var(--text-on-dark)",
                    border:         "none",
                    borderRadius:   8,
                    boxShadow:      "var(--shadow-md)",
                    fontFamily:     "var(--font-martian-mono, 'Courier New', monospace)",
                    fontSize:       13,
                    fontWeight:     500,
                    letterSpacing:  "0.08em",
                    textTransform:  "uppercase",
                    cursor:         loading ? "not-allowed" : "pointer",
                    opacity:        loading ? 0.65 : 1,
                  }}
                >
                  {/* Shimmer sweep on hover */}
                  <motion.div
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    style={{
                      position:      "absolute",
                      inset:         0,
                      background:    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                      pointerEvents: "none",
                    }}
                  />
                  {loading ? "Signing in…" : "Sign In"}
                </motion.button>
              </div>
            </FadeUp>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
