"use client";

import { motion } from "framer-motion";

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: React.ElementType;
}

interface SegmentedControlProps<T extends string> {
  id?: string;
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
}

export function SegmentedControl<T extends string>({
  id = "seg",
  value,
  onChange,
  options,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center"
      style={{
        border:       "1.5px solid var(--border-medium)",
        borderRadius: 8,
        background:   "var(--bg-ground)",
        height:       32,
        padding:      3,
        gap:          1,
      }}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className="relative flex items-center gap-1.5 h-full"
            style={{
              padding:      "0 12px",
              borderRadius: 6,
              fontSize:     13,
              fontFamily:   "var(--font-instrument-sans)",
              fontWeight:   isActive ? 500 : 400,
              color:        isActive ? "var(--text-primary)" : "var(--text-secondary)",
              cursor:       "pointer",
              border:       "none",
              background:   "transparent",
              transition:   "color 150ms ease",
            }}
          >
            {isActive && (
              <motion.div
                layoutId={`${id}-bg`}
                className="absolute inset-0"
                style={{
                  background:   "var(--bg-surface)",
                  borderRadius: 6,
                  boxShadow:    "var(--shadow-sm)",
                }}
                transition={{ ease: [0.25, 0.1, 0.25, 1], duration: 0.15 }}
              />
            )}
            {Icon && (
              <span className="relative" style={{ display: "flex", alignItems: "center" }}>
                <Icon size={13} strokeWidth={1.5} />
              </span>
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
