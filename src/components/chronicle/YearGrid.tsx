"use client";

import { useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayCell {
  date: Date;
  dateStr: string;
  hours: number;
  isToday: boolean;
  isFuture: boolean;
  isPast: boolean;
  hasEntries: boolean;
  col: number;
  row: number;
  x: number;
  y: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const DAY_LABEL_ROWS: Record<number, string> = { 0: "M", 2: "W", 4: "F" };

// Ink-on-warm-paper palette (dark dots on light background)
const C_FUTURE  = "rgba(168, 161, 145, 0.38)";  // very faint warm gray
const C_EMPTY   = "rgba(148, 140, 122, 0.62)";  // medium warm gray
const C_LOGGED  = "rgba(38, 34, 24, 0.86)";     // warm near-black ink
const C_TODAY   = "rgba(32, 28, 18, 0.94)";     // deepest ink for today
const C_LABEL   = "rgba(128, 120, 100, 0.50)";  // muted warm label

// ─── Helpers ─────────────────────────────────────────────────────────────────

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function hoursToRadius(hours: number, maxR: number, minR: number): number {
  if (hours <= 0) return minR;
  if (hours >= 8) return maxR;
  return minR + (maxR - minR) * (hours / 8);
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildYear(year: number, data: Record<string, number>): DayCell[] {
  const todayRaw = new Date();
  todayRaw.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(todayRaw);

  const jan1 = new Date(year, 0, 1);
  const jan1Weekday = (jan1.getDay() + 6) % 7; // Mon=0

  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const total  = isLeap ? 366 : 365;
  const days: DayCell[] = [];

  for (let i = 0; i < total; i++) {
    const date    = new Date(year, 0, 1 + i);
    const dateStr = toDateStr(date);
    const hours   = data[dateStr] ?? 0;
    const col     = Math.floor((jan1Weekday + i) / 7);
    const row     = (jan1Weekday + i) % 7;
    const isToday = dateStr === todayStr;
    const isFuture= date > todayRaw;

    days.push({
      date, dateStr, hours, isToday, isFuture,
      isPast: !isToday && !isFuture,
      hasEntries: hours > 0,
      col, row, x: 0, y: 0,
    });
  }
  return days;
}

function formatTooltip(day: DayCell): string {
  const d     = day.date;
  const label = `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
  if (day.isToday)   return `Today · ${day.hasEntries ? `${day.hours}h` : "in progress"}`;
  if (day.isFuture)  return label;
  if (day.hasEntries)return `${label} · ${day.hours}h`;
  return `${label} · no entries`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  data: Record<string, number>;
  year: number;
  "aria-label"?: string;
}

export function YearGrid({ data, year, "aria-label": ariaLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const tooltipRef   = useRef<HTMLDivElement>(null);
  const rafRef       = useRef<number>(0);
  const mouseRef     = useRef<{ x: number; y: number } | null>(null);

  const stateRef = useRef({
    phase:       "waiting" as "waiting" | "assembling" | "complete",
    waitStart:   0,
    asmStart:    0,
    pulseOrigin: 0,
    dotProg:     {} as Record<number, number>,
    loggedOrder: [] as number[],
    days:        [] as DayCell[],
    cellSize:    16,
    gridX:       0,
    gridY:       0,
  });

  useEffect(() => {
    const container = containerRef.current as HTMLDivElement;
    const canvas    = canvasRef.current    as HTMLCanvasElement;
    const tooltip   = tooltipRef.current   as HTMLDivElement;
    if (!container || !canvas || !tooltip) return;

    const dpr = window.devicePixelRatio || 1;
    let W = 0, H = 0;

    function setupCanvas(w: number, h: number) {
      W = w; H = h;
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      computeLayout(w, h);
    }

    function computeLayout(w: number, h: number) {
      const LPAD = 22;
      const TPAD = 18;
      const EDGE = 40;

      const days    = buildYear(year, data);
      const maxCols = (days.at(-1)?.col ?? 52) + 1;

      const availW   = w - EDGE * 2 - LPAD;
      const availH   = h - EDGE * 2 - TPAD;
      const cellByW  = Math.floor(availW / maxCols);
      const cellByH  = Math.floor(availH / 7);
      const cellSize = Math.min(18, Math.max(10, Math.min(cellByW, cellByH)));

      const gridW = maxCols * cellSize;
      const gridH = 7 * cellSize;
      const gridX = EDGE + LPAD + Math.floor((availW - gridW) / 2);
      const gridY = EDGE + TPAD + Math.floor((availH - gridH) / 2);

      days.forEach(d => {
        d.x = gridX + d.col * cellSize + cellSize / 2;
        d.y = gridY + d.row * cellSize + cellSize / 2;
      });

      const loggedOrder = days
        .map((_, i) => i)
        .filter(i => days[i].hasEntries && (days[i].isPast || days[i].isToday))
        .sort((a, b) =>
          days[a].col !== days[b].col
            ? days[a].col - days[b].col
            : days[a].row - days[b].row
        );

      const s = stateRef.current;
      s.days        = days;
      s.cellSize    = cellSize;
      s.gridX       = gridX;
      s.gridY       = gridY;
      s.loggedOrder = loggedOrder;
      s.dotProg     = {};
      s.phase       = "waiting";
      s.waitStart   = performance.now();
    }

    function draw() {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const s   = stateRef.current;
      const now = performance.now();
      const { days, cellSize, gridX, gridY } = s;

      if (s.phase === "waiting" && now - s.waitStart >= 200) {
        s.phase    = "assembling";
        s.asmStart = now;
      }

      if (s.phase === "assembling") {
        const elapsed = now - s.asmStart;
        let allDone = true;
        s.loggedOrder.forEach((idx, i) => {
          const starts = i * 6;
          if (elapsed < starts) { allDone = false; return; }
          const p = Math.min(1, (elapsed - starts) / 200);
          s.dotProg[idx] = p;
          if (p < 1) allDone = false;
        });
        if (s.loggedOrder.length === 0 || allDone) {
          s.phase       = "complete";
          s.pulseOrigin = now;
        }
      }

      ctx.clearRect(0, 0, W, H);

      const baseR   = cellSize * 0.090;
      const minLogR = cellSize * 0.085;
      const maxLogR = cellSize * 0.160;

      // Month labels
      ctx.font      = `9px var(--font-martian-mono, 'Courier New', monospace)`;
      ctx.fillStyle = C_LABEL;
      ctx.textAlign = "left";

      const jan1    = new Date(year, 0, 1);
      const jan1WD  = (jan1.getDay() + 6) % 7;
      let lastLCol  = -99;

      for (let m = 0; m < 12; m++) {
        const ms   = new Date(year, m, 1);
        const diff = Math.floor((ms.getTime() - jan1.getTime()) / 86400000);
        const col  = Math.floor((jan1WD + diff) / 7);
        if (col - lastLCol >= 2) {
          ctx.fillText(MONTHS[m], gridX + col * cellSize, gridY - 6);
          lastLCol = col;
        }
      }

      // Day labels
      ctx.textAlign = "right";
      Object.entries(DAY_LABEL_ROWS).forEach(([rowStr, lbl]) => {
        const row = parseInt(rowStr);
        ctx.fillText(lbl, gridX - 5, gridY + row * cellSize + cellSize / 2 + 3.5);
      });

      // Dots — skip today (drawn last)
      const todayIdx = days.findIndex(d => d.isToday);

      for (let i = 0; i < days.length; i++) {
        if (i === todayIdx) continue;
        const day = days[i];
        let r: number, color: string;

        if (day.isFuture) {
          r = baseR; color = C_FUTURE;
        } else if (!day.hasEntries) {
          r = baseR; color = C_EMPTY;
        } else {
          const target = hoursToRadius(day.hours, maxLogR, minLogR);
          const prog   = s.dotProg[i] ?? 0;
          r     = baseR + (target - baseR) * easeOut(prog);
          color = C_LOGGED;
        }

        ctx.beginPath();
        ctx.arc(day.x, day.y, Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // Today — always on top with pulse ring
      if (todayIdx >= 0) {
        const td  = days[todayIdx];
        const tdR = td.hasEntries ? hoursToRadius(td.hours, maxLogR, minLogR) : baseR;

        const pulseProg   = ((now - s.pulseOrigin) % 2000) / 2000;
        const ringOpacity = Math.sin(pulseProg * Math.PI) * 0.35;
        const ringR       = tdR + 2 + pulseProg * 3;

        ctx.beginPath();
        ctx.arc(td.x, td.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(32, 28, 18, ${ringOpacity})`;
        ctx.lineWidth   = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(td.x, td.y, tdR, 0, Math.PI * 2);
        ctx.fillStyle = C_TODAY;
        ctx.fill();
      }

      // Hover / tooltip
      const mouse = mouseRef.current;
      if (mouse) {
        let nearestIdx = -1, nearestDist = 14 * 14;
        for (let i = 0; i < days.length; i++) {
          const dx = mouse.x - days[i].x;
          const dy = mouse.y - days[i].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < nearestDist) { nearestDist = d2; nearestIdx = i; }
        }
        if (nearestIdx >= 0) {
          const day = days[nearestIdx];
          tooltip.textContent         = formatTooltip(day);
          tooltip.style.transform     = `translate(${day.x}px,${day.y - 14}px) translate(-50%,-100%)`;
          tooltip.style.opacity       = "1";
        } else {
          tooltip.style.opacity = "0";
        }
      } else {
        tooltip.style.opacity = "0";
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function onMouseLeave() { mouseRef.current = null; }

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);

    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) {
        cancelAnimationFrame(rafRef.current);
        setupCanvas(width, height);
        rafRef.current = requestAnimationFrame(draw);
      }
    });
    ro.observe(container);

    const { width, height } = container.getBoundingClientRect();
    if (width > 0 && height > 0) {
      setupCanvas(width, height);
      rafRef.current = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [year, data]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0 }}
      aria-label={ariaLabel}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      <div
        ref={tooltipRef}
        style={{
          position:      "absolute",
          top:           0,
          left:          0,
          fontFamily:    "var(--font-martian-mono, 'Courier New', monospace)",
          fontSize:      11,
          lineHeight:    "16px",
          color:         "var(--bg-ground, #f5f4f0)",
          background:    "var(--text-primary, #1a1816)",
          padding:       "3px 8px",
          borderRadius:  3,
          pointerEvents: "none",
          whiteSpace:    "nowrap",
          opacity:       0,
          transition:    "opacity 80ms ease",
          zIndex:        10,
        }}
      />
    </div>
  );
}
