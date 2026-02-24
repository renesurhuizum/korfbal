import { SHOT_TYPES } from '../constants/shotTypes';

/**
 * Exports match statistics as a CSV file download.
 * @param {object[]} matches - Array of finished match objects
 * @param {string} teamName - Team name for filename
 */
export function exportMatchesCSV(matches, teamName) {
  const finishedMatches = matches.filter(m => m.finished);
  if (finishedMatches.length === 0) {
    throw new Error('Geen afgeronde wedstrijden om te exporteren');
  }

  let csv = 'Datum,Tegenstander,Score,Resultaat\n';
  finishedMatches.forEach(match => {
    const date = new Date(match.date).toLocaleDateString('nl-NL');
    const result = match.score > match.opponent_score ? 'Gewonnen'
      : match.score < match.opponent_score ? 'Verloren' : 'Gelijkspel';
    csv += `${date},${match.opponent},${match.score}-${match.opponent_score},${result}\n`;
  });

  csv += '\nSpeler,Wedstrijden,Doelpunten,Pogingen,Schot%';
  SHOT_TYPES.forEach(t => { csv += `,${t.short} Goals,${t.short} Pogingen`; });
  csv += '\n';

  const playerStats = {};
  finishedMatches.forEach(match => {
    (match.players || []).forEach(player => {
      if (!player?.name) return;
      if (!playerStats[player.name]) {
        playerStats[player.name] = {
          matches: 0, goals: 0, attempts: 0,
          byType: Object.fromEntries(SHOT_TYPES.map(t => [t.id, { goals: 0, attempts: 0 }])),
        };
      }
      const s = playerStats[player.name];
      s.matches++;
      SHOT_TYPES.forEach(type => {
        const ts = player.stats?.[type.id] || { goals: 0, attempts: 0 };
        s.goals += ts.goals || 0;
        s.attempts += ts.attempts || 0;
        s.byType[type.id].goals += ts.goals || 0;
        s.byType[type.id].attempts += ts.attempts || 0;
      });
    });
  });

  Object.entries(playerStats).forEach(([name, s]) => {
    const pct = s.attempts > 0 ? Math.round((s.goals / s.attempts) * 100) : 0;
    let row = `${name},${s.matches},${s.goals},${s.attempts},${pct}%`;
    SHOT_TYPES.forEach(t => {
      row += `,${s.byType[t.id].goals},${s.byType[t.id].attempts}`;
    });
    csv += row + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${teamName}_statistieken_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
