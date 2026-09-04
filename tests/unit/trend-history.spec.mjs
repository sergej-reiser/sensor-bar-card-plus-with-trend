import { describe, expect, it } from 'vitest';
import { calculateTrend, getOldestTrendValue, indexHistoryResponse } from '../../src/trend/history.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCard } = require('../support/load-card-class.cjs');

const now = Date.parse('2026-09-04T12:00:00Z');

describe('history trends', () => {
  it('uses the oldest numeric state inside the entity lookback period', () => {
    const history = [
      { state: '99', last_changed: '2026-09-03T11:59:00Z' },
      { state: 'unknown', last_changed: '2026-09-03T12:01:00Z' },
      { state: '64.2', last_changed: '2026-09-03T12:02:00Z' },
      { state: '63', last_changed: '2026-09-04T08:00:00Z' },
    ];
    expect(getOldestTrendValue(history, now - 24 * 60 * 60 * 1000)).toBe(64.2);
    expect(calculateTrend(
      { state: '61.4' },
      history,
      { show: true, hours: 24, deadband: 0.5 },
      now
    )).toEqual({ delta: -2.8000000000000043, arrow: '↓' });
  });

  it('handles stable, rising, unavailable, and missing-history values', () => {
    const history = [{ state: '10', last_changed: '2026-09-04T00:00:00Z' }];
    const config = { show: true, hours: 24, deadband: 0.5 };
    expect(calculateTrend({ state: '10.2' }, history, config, now)?.arrow).toBe('→');
    expect(calculateTrend({ state: '11' }, history, config, now)?.arrow).toBe('↑');
    expect(calculateTrend({ state: 'unavailable' }, history, config, now)).toBeNull();
    expect(calculateTrend({ state: '11' }, [], config, now)).toBeNull();
  });

  it('indexes one batched Home Assistant response by entity', () => {
    const response = [
      [{ entity_id: 'sensor.one', state: '1' }],
      [{ state: '2' }],
    ];
    expect(indexHistoryResponse(response, ['sensor.one', 'sensor.two'])).toEqual({
      'sensor.one': response[0],
      'sensor.two': response[1],
    });
  });

  it('indexes the entity-keyed response returned by Home Assistant', () => {
    const response = {
      'sensor.one': [{ state: '1', last_changed: '2026-09-04T00:00:00Z' }],
      'sensor.two': [{ state: '2', last_changed: '2026-09-04T00:00:00Z' }],
      'sensor.unrequested': [{ state: '3', last_changed: '2026-09-04T00:00:00Z' }],
    };
    expect(indexHistoryResponse(response, ['sensor.one', 'sensor.two'])).toEqual({
      'sensor.one': response['sensor.one'],
      'sensor.two': response['sensor.two'],
    });
  });

  it('normalizes overrides, batches enabled entities, and reuses the cache', async () => {
    const card = createCard();
    const calls = [];
    card._config = card.normalizeCardConfig({
      trend: { show: true, hours: 24, decimals: 1, deadband: 0.5 },
      entities: [
        { entity: 'sensor.one' },
        { entity: 'sensor.two', trend: { hours: 12, deadband: 1 } },
        { entity: 'sensor.three', trend: false },
      ],
    });
    card._hass = {
      states: {},
      callWS: async (message) => {
        calls.push(message);
        return { 'sensor.one': [], 'sensor.two': [] };
      },
    };
    card._update = () => {};

    await card._ensureTrendHistory();
    await card._ensureTrendHistory();

    expect(card._config.entities[1].trend).toMatchObject({ show: true, hours: 12, deadband: 1, decimals: 1 });
    expect(card._config.entities[2].trend.show).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      type: 'history/history_during_period',
      entity_ids: ['sensor.one', 'sensor.two'],
      minimal_response: false,
      no_attributes: true,
    });
    expect(Date.parse(calls[0].end_time) - Date.parse(calls[0].start_time)).toBe(24 * 60 * 60 * 1000);
  });

  it('renders a trend after the name with the entity display unit', () => {
    const card = createCard();
    const config = card.normalizeCardConfig({
      trend: { show: true, hours: 24, decimals: 1, deadband: 0.5 },
      entities: [{ entity: 'sensor.moisture', name: 'Palme' }],
    });
    const state = { state: '61.4', attributes: { unit_of_measurement: '%' } };
    card._trendHistory = {
      'sensor.moisture': [{ state: '64.2', last_changed: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString() }],
    };
    expect(card._formatNameMarkup('Palme', config.entities[0], state))
      .toContain('<span class="entity-name">Palme</span><span class="trend-indicator"');
    expect(card._formatNameMarkup('Palme', config.entities[0], state)).toContain('↓ 2.8 %');
  });
});
