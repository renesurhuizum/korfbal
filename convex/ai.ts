"use node"; // Required for @anthropic-ai/sdk (npm package)

import { action, internalMutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

// Read cached advice for a team (called from frontend via useQuery)
export const getAdvice = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ai_advice")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .first();
  },
});

// Persist generated advice — only called internally from the action
export const saveAdvice = internalMutation({
  args: {
    teamId: v.id("teams"),
    advice: v.string(),
    matchCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Replace existing advice for this team
    const existing = await ctx.db
      .query("ai_advice")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("ai_advice", {
      teamId: args.teamId,
      advice: args.advice,
      generatedAt: Date.now(),
      basedOnMatchCount: args.matchCount,
    });
  },
});

// Generate personalised training advice using Claude
export const generateTrainingAdvice = action({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Niet ingelogd — log eerst in");

    // Fetch all stats in parallel
    const [teamStats, form, players, shotTrend, opponents] = await Promise.all([
      ctx.runQuery(api.stats.getTeamStats, { teamId: args.teamId }),
      ctx.runQuery(api.stats.getFormLastN, { teamId: args.teamId, n: 5 }),
      ctx.runQuery(api.stats.getPlayerCareerStats, { teamId: args.teamId }),
      ctx.runQuery(api.stats.getShotTypeTrend, { teamId: args.teamId, n: 10 }),
      ctx.runQuery(api.stats.getOpponentStats, { teamId: args.teamId }),
    ]);

    const totalMatches = (teamStats as any)?.totalMatches ?? 0;
    if (totalMatches < 5) {
      throw new Error(
        "Minimaal 5 wedstrijden nodig voor zinvol trainingsadvies"
      );
    }

    // Build structured Dutch prompt
    const prompt = buildPrompt(teamStats, form, players, shotTrend, opponents);

    // Call Claude API
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY niet ingesteld in Convex");

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const advice = (message.content[0] as { type: string; text: string }).text;

    // Persist to database
    await ctx.runMutation(internal.ai.saveAdvice, {
      teamId: args.teamId,
      advice,
      matchCount: totalMatches,
    });

    return advice;
  },
});

// Build a structured Dutch prompt from aggregated team statistics
function buildPrompt(
  teamStats: any,
  form: any,
  players: any,
  shotTrend: any,
  opponents: any
): string {
  // Recent form string: e.g. "W W V D W"
  const formStr = Array.isArray(form)
    ? form.map((m: any) => m.result).join(" ")
    : "—";

  // Top 3 scorers
  const topPlayers = Array.isArray(players)
    ? players
        .slice(0, 3)
        .map(
          (p: any) =>
            `  - ${p.name}: ${p.goals} doelpunten in ${p.matches} wedstrijden (${p.percentage}% raak)`
        )
        .join("\n")
    : "  - Geen spelersdata beschikbaar";

  // Shot type trend rows
  const trendRows = Array.isArray(shotTrend)
    ? shotTrend
        .map((s: any) => {
          const arrow =
            s.trend === "up" ? "↑" : s.trend === "down" ? "↓" : "=";
          return `  - ${s.label}: seizoen ${s.season.pct}% → recent ${s.recent.pct}% ${arrow}`;
        })
        .join("\n")
    : "  - Geen schotdata beschikbaar";

  // Best opponent record
  const bestOpponent =
    Array.isArray(opponents) && opponents.length > 0
      ? opponents
          .filter((o: any) => o.played >= 2)
          .sort((a: any, b: any) => b.winPercentage - a.winPercentage)[0]
      : null;

  const opponentNote = bestOpponent
    ? `Sterkste tegenstander: ${bestOpponent.name} (${bestOpponent.played} wedstrijden, ${bestOpponent.winPercentage}% gewonnen)`
    : "";

  return `Je bent een ervaren korfbalcoach. Analyseer de onderstaande teamstatistieken en geef 3-4 concrete, praktische trainingstips in het Nederlands. Wees specifiek: verwijs naar de schottypes, spelers en cijfers uit de data.

SEIZOENSOVERZICHT (${teamStats.totalMatches} wedstrijden):
  Resultaten: ${teamStats.totalWins} gewonnen, ${teamStats.totalDraws} remise, ${teamStats.totalLosses} verloren
  Doelpunten: ${teamStats.totalGoalsFor} voor / ${teamStats.totalGoalsAgainst} tegen (verschil: ${teamStats.goalDifference})
  Schot%: ${teamStats.shotPercentage}% (${teamStats.totalAttempts} pogingen totaal)

RECENTE VORM (laatste 5 wedstrijden): ${formStr}

SCHOTTYPES — seizoen% → recent%:
${trendRows}

TOP SCORERS:
${topPlayers}
${opponentNote ? `\n${opponentNote}` : ""}

Geef jouw trainingsadvies. Begin direct met de tips, geen inleiding nodig.`;
}
