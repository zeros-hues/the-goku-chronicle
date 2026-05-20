const CLIENT_COLORS = [
  "#3B82F6", // blue
  "#8B5CF6", // purple
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#06B6D4", // cyan
  "#EC4899", // pink
  "#84CC16", // lime
];

const GOKU_STUDIO_COLOR = "#6B7280"; // grey

export function getClientColor(clientName: string, index: number): string {
  if (clientName === "Goku Studio") return GOKU_STUDIO_COLOR;
  return CLIENT_COLORS[index % CLIENT_COLORS.length];
}

export function hexToRgb(hex: string, alpha = 0.15): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
