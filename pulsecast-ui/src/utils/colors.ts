/** Color encoding from the PulseCast spec */

export const COLORS = {
  idle: '#e0e0e0',          // surface-2
  lowLoadStart: '#8a3ffc',  // purple-60
  lowLoadEnd: '#0f62fe',    // blue-60
  moderateLoad: '#ff832b',  // orange-40
  congested: '#da1e28',     // red-60

  // Extended (Carbon palette)
  accentBlue: '#0f62fe',
  accentCyan: '#1192e8',
  accentPurple: '#8a3ffc',
  accentGreen: '#24a148',
  accentAmber: '#f1c21b',
  accentRed: '#da1e28',
} as const;

/**
 * Map occupancy (0.0–1.0) to a color using the spec's encoding.
 * Idle → Low Load → Moderate Load → Congested
 */
export function occupancyToColor(occupancy: number): string {
  if (occupancy < 0.25) {
    // Idle → Low load start
    return lerpColor(COLORS.idle, COLORS.lowLoadStart, occupancy / 0.25);
  } else if (occupancy < 0.5) {
    // Low load start → Low load end
    return lerpColor(COLORS.lowLoadStart, COLORS.lowLoadEnd, (occupancy - 0.25) / 0.25);
  } else if (occupancy < 0.75) {
    // Low load end → Moderate load
    return lerpColor(COLORS.lowLoadEnd, COLORS.moderateLoad, (occupancy - 0.5) / 0.25);
  } else {
    // Moderate → Congested
    return lerpColor(COLORS.moderateLoad, COLORS.congested, (occupancy - 0.75) / 0.25);
  }
}

/**
 * Map forecast risk score (0.0–1.0) to a semi-transparent overlay color.
 */
export function forecastToColor(score: number): string {
  const base = occupancyToColor(score);
  const alpha = 0.15 + score * 0.45;
  return hexToRgba(base, alpha);
}

/**
 * Get the glow intensity for a node based on its occupancy.
 */
export function occupancyToGlow(occupancy: number): number {
  return Math.max(0, (occupancy - 0.5) * 40);
}

/**
 * Color for node role badge.
 */
export function roleToColor(role: string): string {
  switch (role) {
    case 'sender': return COLORS.accentBlue;
    case 'receiver': return COLORS.accentGreen;
    case 'congestion_source': return COLORS.accentRed;
    default: return COLORS.accentPurple;
  }
}

/* ── Helpers ── */

function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);

  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
