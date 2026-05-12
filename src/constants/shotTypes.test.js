import { describe, it, expect } from 'vitest';
import { SHOT_TYPES } from './shotTypes';

describe('SHOT_TYPES', () => {
  it('bevat precies 7 schot-types', () => {
    expect(SHOT_TYPES).toHaveLength(7);
  });

  it('elk type heeft id, label en short', () => {
    SHOT_TYPES.forEach(type => {
      expect(type).toHaveProperty('id');
      expect(type).toHaveProperty('label');
      expect(type).toHaveProperty('short');
    });
  });

  it('IDs zijn uniek', () => {
    const ids = SHOT_TYPES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('short codes zijn uniek', () => {
    const shorts = SHOT_TYPES.map(t => t.short);
    expect(new Set(shorts).size).toBe(shorts.length);
  });

  it('bevat alle verwachte IDs', () => {
    const ids = SHOT_TYPES.map(t => t.id);
    ['distance','close','penalty','freeball','runthrough','outstart','other'].forEach(id => {
      expect(ids).toContain(id);
    });
  });
});
