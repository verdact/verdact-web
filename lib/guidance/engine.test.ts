import { describe, it, expect } from 'vitest';
import { evaluateGuidance } from './engine';
import type { GuidanceSignals, GuidancePersona } from './types';

function createMockSignals(overrides: Partial<GuidanceSignals> = {}): GuidanceSignals {
  return {
    hasStripe: true,
    openDisputeCount: 0,
    needsActionCount: 0,
    nearestDeadlineDays: null,
    profileComplete: true,
    actionableEfwCount: 0,
    healthConfident: true,
    healthBand: 'healthy',
    personaKnown: true,
    ...overrides,
  };
}

describe('evaluateGuidance spine invariant', () => {
  it('preserves the relative priority of spine rules when all fire', () => {
    // We want to test the weights of rules. The engine returns GuidanceItems which include weight.
    const signals = createMockSignals({
      hasStripe: true,
      needsActionCount: 1,
      nearestDeadlineDays: 2,
      healthConfident: true,
      healthBand: 'at-risk',
      actionableEfwCount: 1,
      profileComplete: false,
    });

    const personas: (GuidancePersona | undefined)[] = [undefined, 'marcus', 'priya', 'david', 'aisha'];

    for (const persona of personas) {
      const result = evaluateGuidance(signals, { persona, maxBand: 10 });
      
      const getIndex = (id: string) => result.band.findIndex(r => r.id === id);
      
      const needsResponseIdx = getIndex('needs-response');
      const healthWatchIdx = getIndex('health-watch');
      const efwPreventIdx = getIndex('efw-prevent');
      const completeProfileIdx = getIndex('complete-profile');

      expect(needsResponseIdx).toBeGreaterThanOrEqual(0);
      expect(healthWatchIdx).toBeGreaterThanOrEqual(0);
      expect(efwPreventIdx).toBeGreaterThanOrEqual(0);
      expect(completeProfileIdx).toBeGreaterThanOrEqual(0);

      // Verify strict ordering: needs-response > health-watch > efw-prevent > complete-profile
      expect(needsResponseIdx).toBeLessThan(healthWatchIdx);
      expect(healthWatchIdx).toBeLessThan(efwPreventIdx);
      expect(efwPreventIdx).toBeLessThan(completeProfileIdx);
    }
  });

  it('correctly identifies urgent rules based on signals', () => {
    // EFW is always urgent
    let signals = createMockSignals({ actionableEfwCount: 1 });
    let result = evaluateGuidance(signals);
    expect(result.band.find(r => r.id === 'efw-prevent')?.urgent).toBe(true);

    // Needs response is urgent if <= URGENT_DAYS (3)
    signals = createMockSignals({ needsActionCount: 1, nearestDeadlineDays: 3 });
    result = evaluateGuidance(signals);
    expect(result.band.find(r => r.id === 'needs-response')?.urgent).toBe(true);

    // Needs response is NOT urgent if > URGENT_DAYS (3)
    signals = createMockSignals({ needsActionCount: 1, nearestDeadlineDays: 4 });
    result = evaluateGuidance(signals);
    expect(result.band.find(r => r.id === 'needs-response')?.urgent).toBe(false);

    // Health watch is urgent if at-risk
    signals = createMockSignals({ healthBand: 'at-risk' });
    result = evaluateGuidance(signals);
    expect(result.band.find(r => r.id === 'health-watch')?.urgent).toBe(true);

    // Health watch is NOT urgent if close
    signals = createMockSignals({ healthBand: 'close' });
    result = evaluateGuidance(signals);
    expect(result.band.find(r => r.id === 'health-watch')?.urgent).toBe(false);
  });

  it('drops suppressed non-urgent band rules and replaces them with fallbacks if needed', () => {
    // complete-profile is not urgent.
    const signals = createMockSignals({ profileComplete: false });
    
    // Unsuppressed: complete-profile shows up
    let result = evaluateGuidance(signals);
    expect(result.band.find(r => r.id === 'complete-profile')).toBeDefined();

    // Suppressed: complete-profile is dropped
    result = evaluateGuidance(signals, { suppressedRuleIds: new Set(['complete-profile']) });
    expect(result.band.find(r => r.id === 'complete-profile')).toBeUndefined();
    
    // Check fallback filling
    // If complete-profile is dropped, fallbacks should fill.
    // However, fallback-prep-evidence requires profileComplete to be true.
    // So only fallback-watching triggers, making the total length 1.
    expect(result.band.length).toBe(1);
    expect(result.band[0].id).toBe('fallback-watching');
  });

  it('never drops an urgent rule even if its ID is in suppressedRuleIds', () => {
    // efw-prevent is always urgent
    const signals = createMockSignals({ actionableEfwCount: 1 });
    
    const result = evaluateGuidance(signals, { suppressedRuleIds: new Set(['efw-prevent']) });
    expect(result.band.find(r => r.id === 'efw-prevent')).toBeDefined();
    expect(result.band.find(r => r.id === 'efw-prevent')?.urgent).toBe(true);
  });
});
