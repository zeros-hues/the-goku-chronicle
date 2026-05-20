"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";

const InkShader = dynamic(() => import("@/components/InkShader"), { ssr: false });

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

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
    } else {
      router.push("/timesheet");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — Ink Shader (60%) — hidden on mobile */}
      <div className="hidden md:block relative" style={{ flex: "0 0 60%" }}>
        <InkShader className="absolute inset-0" />

        {/* Grain overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.08'/%3E%3C/svg%3E\")",
            mixBlendMode: "overlay",
          }}
        />

        {/* Bottom text overlay */}
        <div className="absolute bottom-10 left-10">
          <p
            className="font-mono text-white"
            style={{
              fontSize: 48,
              fontWeight: 700,
              letterSpacing: "0.15em",
              opacity: 0.08,
              lineHeight: 1,
            }}
          >
            CHRONICLE
          </p>
          <p
            className="font-mono text-white mt-1"
            style={{ fontSize: 11, opacity: 0.2, letterSpacing: "0.1em" }}
          >
            Goku Studio Internal
          </p>
        </div>
      </div>

      {/* Right panel — Login Form (40%) */}
      <div
        className="relative flex-1 flex items-center justify-center"
        style={{ background: "#0E0E0D" }}
      >
        {/* Mobile: blurred shader behind */}
        <div className="md:hidden absolute inset-0 overflow-hidden">
          <InkShader className="absolute inset-0 scale-110" />
          <div className="absolute inset-0" style={{ backdropFilter: "blur(20px)" }} />
        </div>

        {/* Grain on right panel */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 w-full max-w-sm px-12 py-12"
        >
          {/* Wordmark */}
          <div className="mb-10">
            <p
              className="font-mono tracking-widest"
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "#ECEAE4",
                textTransform: "uppercase",
              }}
            >
              CHRONICLE
            </p>
            <p className="mt-1" style={{ fontSize: 12, color: "#6B6966" }}>
              Studio Timesheet
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Username */}
            <div className="relative">
              <motion.label
                animate={{
                  y: focusedField === "username" || username ? -20 : 0,
                  scale: focusedField === "username" || username ? 0.85 : 1,
                  color:
                    focusedField === "username" ? "#ECEAE4" : "#6B6966",
                }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute left-0 top-2 origin-left font-mono pointer-events-none"
                style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                Username
              </motion.label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocusedField("username")}
                onBlur={() => setFocusedField(null)}
                className="w-full pt-6 pb-2 bg-transparent outline-none"
                style={{
                  borderBottom: `1px solid ${
                    focusedField === "username" ? "#ECEAE4" : "#2A2A28"
                  }`,
                  color: "#ECEAE4",
                  fontSize: 14,
                  transition: "border-color 200ms ease",
                }}
                required
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="relative">
              <motion.label
                animate={{
                  y: focusedField === "password" || password ? -20 : 0,
                  scale: focusedField === "password" || password ? 0.85 : 1,
                  color:
                    focusedField === "password" ? "#ECEAE4" : "#6B6966",
                }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute left-0 top-2 origin-left font-mono pointer-events-none"
                style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                Password
              </motion.label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                className="w-full pt-6 pb-2 bg-transparent outline-none"
                style={{
                  borderBottom: `1px solid ${
                    error
                      ? "#E55A4E"
                      : focusedField === "password"
                      ? "#ECEAE4"
                      : "#2A2A28"
                  }`,
                  color: "#ECEAE4",
                  fontSize: 14,
                  transition: "border-color 200ms ease",
                }}
                required
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ fontSize: 12, color: "#E55A4E" }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Sign in button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="relative w-full overflow-hidden font-mono"
              style={{
                background: "#ECEAE4",
                color: "#0E0E0D",
                padding: "14px 0",
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                border: "none",
                borderRadius: 2,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {/* Shimmer on hover */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                  transform: "translateX(-100%)",
                }}
                whileHover={{ transform: "translateX(100%)" }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />
              {loading ? "Signing in…" : "Sign In"}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
