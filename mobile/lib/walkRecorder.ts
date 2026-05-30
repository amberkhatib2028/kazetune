// Stashes the most-recent walk so the post-walk summary screen can
// read it after navigation. Lives in module scope rather than
// AsyncStorage on purpose — we only need it for the immediate
// hand-off from "Stop walking" to the summary modal. If you reload
// the bundle, the record is gone, which is fine.

import type { Pin } from './pins';

export type PathPoint = {
  lat: number;
  lng: number;
  /** ms since epoch (Date.now()) */
  t: number;
};

export type WalkRecord = {
  startedAt: number;
  endedAt: number;
  path: PathPoint[];
  collectedPins: Pin[];
};

let lastWalk: WalkRecord | null = null;

export function setLastWalk(w: WalkRecord) {
  lastWalk = w;
}

export function getLastWalk(): WalkRecord | null {
  return lastWalk;
}

export function clearLastWalk() {
  lastWalk = null;
}

// ----- helpers -------------------------------------------------------

/** Sum of Haversine distances between consecutive path points (m). */
export function pathLengthMeters(path: PathPoint[]): number {
  if (path.length < 2) return 0;
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(h));
  }
  return total;
}

/** Pretty-print a duration in ms as "12m 34s" or "1h 5m". */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** "0.42 km" or "320 m". */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}
