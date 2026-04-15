// state.js — favorites persistence and buildStops logic.
// Translates the relevant parts of model.go and view.go (buildStops).

const STORAGE_KEY = 'shuttle-favorites';

// Returns Map<stopId, nickname> loaded from localStorage.
export function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const data = JSON.parse(raw); // {favorites: [{stopId, nickname?}]}
    const map = new Map();
    for (const entry of (data.favorites ?? [])) {
      map.set(entry.stopId, entry.nickname ?? '');
    }
    return map;
  } catch {
    return new Map();
  }
}

// Persists favorites Map<stopId, nickname> to localStorage.
export function saveFavorites(map) {
  const favorites = [];
  for (const [stopId, nickname] of map) {
    favorites.push(nickname ? { stopId, nickname } : { stopId });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ favorites }));
}

// Toggles favorite status for a stop.
export function toggleFavorite(map, stopId) {
  const next = new Map(map);
  if (next.has(stopId)) {
    next.delete(stopId);
  } else {
    next.set(stopId, '');
  }
  return next;
}

// Sets a nickname for a favorited stop (no-op if not a favorite).
export function setNickname(map, stopId, nickname) {
  if (!map.has(stopId)) return map;
  const next = new Map(map);
  next.set(stopId, nickname.trim());
  return next;
}

// buildStops — translates buildStops() from view.go:141.
// Returns [{stopId, name, arrivals: [{eta: Date, isActive: bool, lateSec: int}]}]
export function buildStops(rides, stopNames, favorites) {
  const arrivalsMap = new Map(); // stopId → [{eta, isActive, lateSec}]
  const stopOrder = [];
  const seen = new Set();

  for (const ride of rides) {
    // Skip completed rides
    if ('Completed' in (ride.state ?? {})) continue;
    const isActive = 'Active' in (ride.state ?? {});

    for (const ssMap of (ride.stopStatus ?? [])) {
      // Each element is {Awaiting: {stopId, expectedArrivalTime}} or another state key
      const info = ssMap['Awaiting'];
      if (!info?.stopId || !info?.expectedArrivalTime) continue;

      const eta = new Date(info.expectedArrivalTime);
      if (isNaN(eta.getTime())) continue;

      const sid = info.stopId;
      if (!seen.has(sid)) {
        seen.add(sid);
        stopOrder.push(sid);
        arrivalsMap.set(sid, []);
      }
      arrivalsMap.get(sid).push({ eta, isActive, lateSec: ride.lateBySec ?? 0 });
    }
  }

  // Sort arrivals per stop by ETA, cap at 4; build result array.
  const stops = [];
  for (const sid of stopOrder) {
    const arrivals = arrivalsMap.get(sid);
    arrivals.sort((a, b) => a.eta - b.eta);
    const capped = arrivals.slice(0, 4);

    let name = sid.slice(0, 8) + '…';
    if (stopNames.has(sid)) name = stopNames.get(sid);

    stops.push({ stopId: sid, name, arrivals: capped });
  }

  return stops;
}
