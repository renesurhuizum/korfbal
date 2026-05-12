import { describe, it, expect } from 'vitest';
import { generatePlayerId } from './generatePlayerId';

describe('generatePlayerId', () => {
  it('geeft een string terug die begint met "player_"', () => {
    expect(generatePlayerId()).toMatch(/^player_/);
  });

  it('bevat een timestamp-segment', () => {
    const before = Date.now();
    const id = generatePlayerId();
    const after = Date.now();
    const ts = parseInt(id.split('_')[1]);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('genereert unieke IDs bij snelle opeenvolgende aanroepen', () => {
    const ids = Array.from({ length: 100 }, () => generatePlayerId());
    const uniek = new Set(ids);
    expect(uniek.size).toBe(100);
  });
});
