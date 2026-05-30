// Route-planning math for the "Walk this playlist" feature.
//
// We're solving the Traveling Salesman Problem on lat/lng points. For
// playlists with up to ~30 pins (think every Princeton building), a
// nearest-neighbor seed followed by 2-opt edge-swap improvement runs
// in well under a second and typically lands within ~5% of optimal.
// That's plenty for a walking tour — turn-by-turn road routing is a
// separate problem we're explicitly not tackling here.
//
// All distances are great-circle (Haversine) in meters. No road graph,
// no elevation, no one-way streets. The polyline drawn on the map is
// straight-line between pins.

type Point = { latitude: number; longitude: number };

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function dist(a: Point, b: Point): number {
  return distanceMeters(a.latitude, a.longitude, b.latitude, b.longitude);
}

/** Greedy nearest-neighbor TSP from `start`. Returns indices into pins
 *  in visit order. Fast O(n^2) — fine for n < a few hundred. */
export function nearestNeighborOrder(start: Point, pins: Point[]): number[] {
  if (pins.length === 0) return [];
  const remaining = new Set<number>();
  for (let i = 0; i < pins.length; i++) remaining.add(i);
  let current: Point = start;
  const order: number[] = [];
  while (remaining.size > 0) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (const i of remaining) {
      const d = dist(current, pins[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    order.push(bestIdx);
    current = pins[bestIdx];
    remaining.delete(bestIdx);
  }
  return order;
}

/** 2-opt: repeatedly try to replace two route edges with their crossed
 *  variant; keep any swap that shortens the total. We treat `startPoint`
 *  as a virtual "node -1" so the first edge (start → first pin) is
 *  also eligible for swapping. Capped at 50 sweeps as a safety. */
export function twoOptImprove(
  startPoint: Point,
  order: number[],
  pins: Point[],
): number[] {
  const route = [...order];
  const n = route.length;
  if (n < 3) return route;

  const pointAt = (k: number): Point =>
    k === -1 ? startPoint : pins[route[k]];

  let improved = true;
  let sweeps = 0;
  while (improved && sweeps++ < 50) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        // Edges to swap: (i-1, i) and (j, j+1).
        const a = pointAt(i - 1);
        const b = pointAt(i);
        const c = pointAt(j);
        const d = j + 1 < n ? pointAt(j + 1) : null;

        const before = dist(a, b) + (d ? dist(c, d) : 0);
        const after = dist(a, c) + (d ? dist(b, d) : 0);

        if (after + 1e-9 < before) {
          // Reverse route[i..j].
          let lo = i;
          let hi = j;
          while (lo < hi) {
            const tmp = route[lo];
            route[lo] = route[hi];
            route[hi] = tmp;
            lo++;
            hi--;
          }
          improved = true;
        }
      }
    }
  }
  return route;
}

/** Total walking distance in meters: start → pin[order[0]] → ... → pin[order[n-1]]. */
export function routeDistanceMeters(
  start: Point,
  order: number[],
  pins: Point[],
): number {
  if (order.length === 0) return 0;
  let total = dist(start, pins[order[0]]);
  for (let i = 1; i < order.length; i++) {
    total += dist(pins[order[i - 1]], pins[order[i]]);
  }
  return total;
}

/** End-to-end: pick an order using NN + 2-opt; return order + total distance. */
export function computeRoute(
  start: Point,
  pins: Point[],
): { order: number[]; distance: number } {
  const nn = nearestNeighborOrder(start, pins);
  const improved = twoOptImprove(start, nn, pins);
  const distance = routeDistanceMeters(start, improved, pins);
  return { order: improved, distance };
}
