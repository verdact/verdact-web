import { describe, it, expect } from 'vitest';
import { computeSuppressedRuleIds, ruleIdsShownOnDay, type GuidanceImpression, REST_WINDOW_HOURS, DISMISS_REST_DAYS } from './cadence';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

describe('Cadence Math', () => {
  describe('computeSuppressedRuleIds', () => {
    it('suppresses a rule dismissed less than DISMISS_REST_DAYS ago', () => {
      const nowMs = Date.parse('2026-06-15T12:00:00Z');
      const impressions: GuidanceImpression[] = [
        {
          rule_id: 'test-rule',
          shown_at: '2026-06-10T12:00:00Z',
          dismissed_at: '2026-06-10T12:00:00Z', // 5 days ago
        }
      ];

      const suppressed = computeSuppressedRuleIds(impressions, nowMs);
      expect(suppressed.has('test-rule')).toBe(true);
    });

    it('does NOT suppress a rule dismissed more than DISMISS_REST_DAYS ago', () => {
      const nowMs = Date.parse('2026-06-15T12:00:00Z');
      const impressions: GuidanceImpression[] = [
        {
          rule_id: 'test-rule',
          shown_at: '2026-06-05T12:00:00Z',
          dismissed_at: '2026-06-05T12:00:00Z', // 10 days ago
        }
      ];

      const suppressed = computeSuppressedRuleIds(impressions, nowMs);
      expect(suppressed.has('test-rule')).toBe(false);
    });

    it('does NOT suppress a rule shown on the exact same UTC day (same-day refresh)', () => {
      const nowMs = Date.parse('2026-06-15T18:00:00Z');
      const impressions: GuidanceImpression[] = [
        {
          rule_id: 'test-rule',
          shown_at: '2026-06-15T08:00:00Z', // 10 hours ago, same UTC day
          dismissed_at: null,
        }
      ];

      const suppressed = computeSuppressedRuleIds(impressions, nowMs);
      expect(suppressed.has('test-rule')).toBe(false);
    });

    it('suppresses a rule shown yesterday but within the 24h rest window', () => {
      // shown yesterday 23:00, now it is today 01:00 (2 hours passed)
      const nowMs = Date.parse('2026-06-15T01:00:00Z');
      const impressions: GuidanceImpression[] = [
        {
          rule_id: 'test-rule',
          shown_at: '2026-06-14T23:00:00Z', 
          dismissed_at: null,
        }
      ];

      const suppressed = computeSuppressedRuleIds(impressions, nowMs);
      expect(suppressed.has('test-rule')).toBe(true);
    });

    it('does NOT suppress a rule shown yesterday and > 24h ago', () => {
      const nowMs = Date.parse('2026-06-15T12:00:00Z');
      const impressions: GuidanceImpression[] = [
        {
          rule_id: 'test-rule',
          shown_at: '2026-06-14T10:00:00Z', // 26 hours ago
          dismissed_at: null,
        }
      ];

      const suppressed = computeSuppressedRuleIds(impressions, nowMs);
      expect(suppressed.has('test-rule')).toBe(false);
    });

    it('only considers the LATEST impression for a rule', () => {
      const nowMs = Date.parse('2026-06-15T12:00:00Z');
      const impressions: GuidanceImpression[] = [
        {
          rule_id: 'test-rule',
          shown_at: '2026-06-01T12:00:00Z',
          dismissed_at: '2026-06-01T12:00:00Z', // Dismissed 14 days ago (expired rest)
        },
        {
          rule_id: 'test-rule',
          shown_at: '2026-06-14T23:00:00Z',
          dismissed_at: null, // Shown yesterday but < 24h ago
        }
      ];

      const suppressed = computeSuppressedRuleIds(impressions, nowMs);
      // The latest impression is the shown one, which should suppress it
      expect(suppressed.has('test-rule')).toBe(true);
    });
  });

  describe('ruleIdsShownOnDay', () => {
    it('returns rules shown on the same UTC day', () => {
      const nowMs = Date.parse('2026-06-15T18:00:00Z');
      const impressions: GuidanceImpression[] = [
        { rule_id: 'rule-today', shown_at: '2026-06-15T02:00:00Z', dismissed_at: null },
        { rule_id: 'rule-yesterday', shown_at: '2026-06-14T23:00:00Z', dismissed_at: null },
      ];

      const shownToday = ruleIdsShownOnDay(impressions, nowMs);
      expect(shownToday.has('rule-today')).toBe(true);
      expect(shownToday.has('rule-yesterday')).toBe(false);
    });
  });
});
