import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportMatchesCSV } from './exportCSV';

const mockClick = vi.fn();
const mockSetAttribute = vi.fn();
const mockLink = {
  setAttribute: mockSetAttribute,
  style: {},
  click: mockClick,
};

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn(),
});

vi.spyOn(document, 'createElement').mockImplementation((tag) => {
  if (tag === 'a') return mockLink;
  return document.createElement.wrappedJSObject?.(tag) ?? {};
});
vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

const mockMatch = {
  finished: true,
  date: '2024-01-15T14:00:00.000Z',
  opponent: 'Testploeg',
  score: 3,
  opponent_score: 2,
  players: [
    {
      name: 'Jan Klaassen',
      stats: {
        distance:   { goals: 2, attempts: 5 },
        close:      { goals: 1, attempts: 2 },
        penalty:    { goals: 0, attempts: 0 },
        freeball:   { goals: 0, attempts: 1 },
        runthrough: { goals: 0, attempts: 0 },
        outstart:   { goals: 0, attempts: 0 },
        other:      { goals: 0, attempts: 0 },
      },
    },
  ],
};

describe('exportMatchesCSV', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gooit error als er geen afgeronde wedstrijden zijn', () => {
    expect(() => exportMatchesCSV([], 'Testteam')).toThrow('Geen afgeronde wedstrijden');
  });

  it('gooit error als alle wedstrijden onafgerond zijn', () => {
    expect(() =>
      exportMatchesCSV([{ ...mockMatch, finished: false }], 'Testteam')
    ).toThrow('Geen afgeronde wedstrijden');
  });

  it('triggert een download bij geldige data', () => {
    exportMatchesCSV([mockMatch], 'Testteam');
    expect(mockClick).toHaveBeenCalledOnce();
  });

  it('stelt de bestandsnaam correct in', () => {
    exportMatchesCSV([mockMatch], 'Testteam');
    const downloadCall = mockSetAttribute.mock.calls.find(([attr]) => attr === 'download');
    expect(downloadCall[1]).toMatch(/^Testteam_statistieken_\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
