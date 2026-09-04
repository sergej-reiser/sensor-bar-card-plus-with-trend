import { getFiniteNumber } from '../config/normalize.js';

export const TREND_CACHE_MS = 5 * 60 * 1000;

function stateTimestamp(state) {
  const raw = state?.last_changed ?? state?.last_updated ?? state?.lu;
  if (typeof raw === 'number') return raw * 1000;
  const timestamp = Date.parse(raw ?? '');
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getOldestTrendValue(history, cutoffMs) {
  if (!Array.isArray(history)) return null;
  let oldest = null;
  for (const state of history) {
    const value = getFiniteNumber(state?.state ?? state?.s);
    const timestamp = stateTimestamp(state);
    if (value === null || timestamp === null || timestamp < cutoffMs) continue;
    if (!oldest || timestamp < oldest.timestamp) oldest = { value, timestamp };
  }
  return oldest?.value ?? null;
}

export function calculateTrend(currentState, history, config, nowMs = Date.now()) {
  if (!config?.show) return null;
  const current = getFiniteNumber(currentState?.state);
  if (current === null) return null;
  const oldest = getOldestTrendValue(history, nowMs - config.hours * 60 * 60 * 1000);
  if (oldest === null) return null;
  const delta = current - oldest;
  const deadband = Number.isFinite(config.deadband) && config.deadband >= 0 ? config.deadband : 0.5;
  const arrow = delta > deadband ? '↑' : (delta < -deadband ? '↓' : '→');
  return { delta, arrow };
}

export function indexHistoryResponse(response, entityIds) {
  const indexed = {};
  if (!Array.isArray(response)) return indexed;
  response.forEach((states, index) => {
    if (!Array.isArray(states)) return;
    const entityId = states.find((state) => state?.entity_id)?.entity_id ?? entityIds[index];
    if (entityId) indexed[entityId] = states;
  });
  return indexed;
}
