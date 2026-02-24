import { query } from "./_generated/server";
import { v } from "convex/values";

// Helper: calculate totals from a single match's player stats
function matchTotals(match: any) {
  let goals = 0;
  let attempts = 0;
  for (const player of match.players || []) {
    for (const shotType of ['distance', 'close', 'penalty', 'freeball', 'runthrough', 'outstart', 'other']) {
      const stat = player.stats?.[shotType];
      if (stat) {
        goals += stat.goals || 0;
        attempts += stat.attempts || 0;
      }
    }
  }
  return { goals, attempts };
}

// Team season summary stats
export const getTeamStats = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_team_id", (q) => q.eq("team_id", args.teamId))
      .filter((q) => q.eq(q.field("finished"), true))
      .collect();

    let totalWins = 0, totalDraws = 0, totalLosses = 0;
    let totalGoalsFor = 0, totalGoalsAgainst = 0;
    let totalAttempts = 0;

    for (const match of matches) {
      totalGoalsFor += match.score;
      totalGoalsAgainst += match.opponent_score;

      const { attempts } = matchTotals(match);
      totalAttempts += attempts;

      if (match.score > match.opponent_score) totalWins++;
      else if (match.score === match.opponent_score) totalDraws++;
      else totalLosses++;
    }

    const totalMatches = matches.length;
    const shotPercentage = totalAttempts > 0
      ? Math.round((totalGoalsFor / totalAttempts) * 100)
      : 0;

    return {
      totalMatches,
      totalWins,
      totalDraws,
      totalLosses,
      totalGoalsFor,
      totalGoalsAgainst,
      goalDifference: totalGoalsFor - totalGoalsAgainst,
      shotPercentage,
      totalAttempts,
    };
  },
});

// Last N matches as W/D/V form
export const getFormLastN = query({
  args: { teamId: v.id("teams"), n: v.number() },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_team_and_date", (q) => q.eq("team_id", args.teamId))
      .filter((q) => q.eq(q.field("finished"), true))
      .collect();

    const sorted = matches.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return sorted.slice(0, args.n).map((match) => {
      let result: "W" | "D" | "V";
      if (match.score > match.opponent_score) result = "W";
      else if (match.score === match.opponent_score) result = "D";
      else result = "V";

      return {
        matchId: match._id,
        opponent: match.opponent,
        score: match.score,
        opponentScore: match.opponent_score,
        date: match.date,
        result,
      };
    });
  },
});

// Goals per month for trend chart
export const getTrendByMonth = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_team_id", (q) => q.eq("team_id", args.teamId))
      .filter((q) => q.eq(q.field("finished"), true))
      .collect();

    const byMonth: Record<string, { month: string; goalsFor: number; goalsAgainst: number; matches: number; wins: number }> = {};

    for (const match of matches) {
      const d = new Date(match.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' });

      if (!byMonth[key]) {
        byMonth[key] = { month: label, goalsFor: 0, goalsAgainst: 0, matches: 0, wins: 0 };
      }
      byMonth[key].goalsFor += match.score;
      byMonth[key].goalsAgainst += match.opponent_score;
      byMonth[key].matches++;
      if (match.score > match.opponent_score) byMonth[key].wins++;
    }

    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  },
});

// Top players by goals
export const getTopPlayers = query({
  args: { teamId: v.id("teams"), limit: v.number() },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_team_id", (q) => q.eq("team_id", args.teamId))
      .filter((q) => q.eq(q.field("finished"), true))
      .collect();

    const playerStats: Record<string, { name: string; goals: number; attempts: number; matches: number }> = {};

    for (const match of matches) {
      for (const player of match.players || []) {
        const id = String(player.id);
        if (!playerStats[id]) {
          playerStats[id] = { name: player.name, goals: 0, attempts: 0, matches: 0 };
        }
        playerStats[id].matches++;
        for (const shotType of ['distance', 'close', 'penalty', 'freeball', 'runthrough', 'outstart', 'other']) {
          const stat = player.stats?.[shotType];
          if (stat) {
            playerStats[id].goals += stat.goals || 0;
            playerStats[id].attempts += stat.attempts || 0;
          }
        }
      }
    }

    return Object.entries(playerStats)
      .map(([id, s]) => ({
        playerId: id,
        name: s.name,
        goals: s.goals,
        attempts: s.attempts,
        matches: s.matches,
        percentage: s.attempts > 0 ? Math.round((s.goals / s.attempts) * 100) : 0,
        goalsPerMatch: s.matches > 0 ? Math.round((s.goals / s.matches) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.goals - a.goals)
      .slice(0, args.limit);
  },
});

// Win percentage per opponent
export const getOpponentStats = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_team_id", (q) => q.eq("team_id", args.teamId))
      .filter((q) => q.eq(q.field("finished"), true))
      .collect();

    const opponents: Record<string, { name: string; played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number }> = {};

    for (const match of matches) {
      const opp = match.opponent;
      if (!opponents[opp]) {
        opponents[opp] = { name: opp, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
      }
      opponents[opp].played++;
      opponents[opp].goalsFor += match.score;
      opponents[opp].goalsAgainst += match.opponent_score;
      if (match.score > match.opponent_score) opponents[opp].wins++;
      else if (match.score === match.opponent_score) opponents[opp].draws++;
      else opponents[opp].losses++;
    }

    return Object.values(opponents)
      .map((o) => ({
        ...o,
        winPercentage: o.played > 0 ? Math.round((o.wins / o.played) * 100) : 0,
      }))
      .sort((a, b) => b.winPercentage - a.winPercentage);
  },
});

// Player of the month (most goals in last 30 days)
export const getPlayerOfMonth = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const matches = await ctx.db
      .query("matches")
      .withIndex("by_team_id", (q) => q.eq("team_id", args.teamId))
      .filter((q) =>
        q.and(
          q.eq(q.field("finished"), true),
          q.gte(q.field("date"), thirtyDaysAgo)
        )
      )
      .collect();

    const playerGoals: Record<string, { name: string; goals: number }> = {};

    for (const match of matches) {
      for (const player of match.players || []) {
        const id = String(player.id);
        if (!playerGoals[id]) playerGoals[id] = { name: player.name, goals: 0 };
        for (const shotType of ['distance', 'close', 'penalty', 'freeball', 'runthrough', 'outstart', 'other']) {
          playerGoals[id].goals += player.stats?.[shotType]?.goals || 0;
        }
      }
    }

    const ranked = Object.entries(playerGoals)
      .map(([id, s]) => ({ playerId: id, ...s }))
      .filter((p) => p.goals > 0)
      .sort((a, b) => b.goals - a.goals);

    return ranked[0] || null;
  },
});
