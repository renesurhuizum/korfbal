import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Auth guard: verify Clerk identity + team membership
async function requireMember(ctx: any, teamId: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Niet ingelogd — log in via je e-mailadres");
  const member = await ctx.db
    .query("team_members")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", teamId).eq("userId", identity.subject)
    )
    .first();
  if (!member) throw new Error("Geen toegang tot dit team");
  return member;
}

// Get matches for a team
export const getTeamMatches = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_team_id", (q) => q.eq("team_id", args.teamId))
      .collect();

    // Sort by date descending (most recent first)
    return matches.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  },
});

// Get all matches (God mode)
export const getAllMatches = query({
  args: {},
  handler: async (ctx) => {
    const matches = await ctx.db.query("matches").collect();

    // Sort by date descending
    return matches.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  },
});

// Create match
export const createMatch = mutation({
  args: {
    teamId: v.id("teams"),
    teamName: v.string(),
    opponent: v.string(),
    date: v.string(),
    players: v.any(), // Complex nested structure
    score: v.number(),
    opponentScore: v.number(),
    opponentGoals: v.optional(v.any()),
    goals: v.optional(v.any()),
    finished: v.optional(v.boolean()),
    shareable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Normalize players to exactly match schema (guards against stale/malformed data)
    const players = ((args.players as any[]) || [])
      .filter((p: any) => p.id !== undefined && p.id !== null)
      .map((p: any) => ({
        id: p.id,
        name: p.name ?? 'Onbekend',
        isStarter: p.isStarter ?? false,
        stats: {
          distance:   { goals: Number(p.stats?.distance?.goals)   || 0, attempts: Number(p.stats?.distance?.attempts)   || 0 },
          close:      { goals: Number(p.stats?.close?.goals)      || 0, attempts: Number(p.stats?.close?.attempts)      || 0 },
          penalty:    { goals: Number(p.stats?.penalty?.goals)    || 0, attempts: Number(p.stats?.penalty?.attempts)    || 0 },
          freeball:   { goals: Number(p.stats?.freeball?.goals)   || 0, attempts: Number(p.stats?.freeball?.attempts)   || 0 },
          runthrough: { goals: Number(p.stats?.runthrough?.goals) || 0, attempts: Number(p.stats?.runthrough?.attempts) || 0 },
          outstart:   { goals: Number(p.stats?.outstart?.goals)   || 0, attempts: Number(p.stats?.outstart?.attempts)   || 0 },
          other:      { goals: Number(p.stats?.other?.goals)      || 0, attempts: Number(p.stats?.other?.attempts)      || 0 },
        },
      }));

    // Normalize goals
    const goals = ((args.goals as any[]) || [])
      .filter((g: any) => g.playerId !== undefined && g.playerId !== null)
      .map((g: any) => ({
        playerId:   g.playerId,
        playerName: g.playerName ?? 'Onbekend',
        shotType:   g.shotType ?? 'other',
        timestamp:  g.timestamp ?? new Date().toISOString(),
        isOwn:      g.isOwn ?? false,
      }));

    // Normalize opponent goals
    const opponentGoals = ((args.opponentGoals as any[]) || []).map((g: any) => ({
      type:       g.type ?? 'other',
      time:       g.time ?? new Date().toISOString(),
      concededBy: g.concededBy ?? 'Onbekend',
    }));

    await requireMember(ctx, args.teamId);

    const matchId = await ctx.db.insert("matches", {
      team_id: args.teamId,
      team_name: args.teamName,
      opponent: args.opponent,
      date: args.date,
      players,
      score: args.score,
      opponent_score: args.opponentScore,
      opponent_goals: opponentGoals,
      goals,
      finished: args.finished !== false,
      shareable: args.shareable || false,
    });

    return matchId;
  },
});

// Update match (for sharing feature)
export const updateMatch = mutation({
  args: {
    matchId: v.id("matches"),
    shareable: v.optional(v.boolean()),
    goals: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error("Wedstrijd niet gevonden");
    await requireMember(ctx, match.team_id);

    const updates: any = {};
    if (args.shareable !== undefined) updates.shareable = args.shareable;
    if (args.goals !== undefined) updates.goals = args.goals;

    await ctx.db.patch(args.matchId, updates);
  },
});

// Delete match
export const deleteMatch = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error("Wedstrijd niet gevonden");
    await requireMember(ctx, match.team_id);
    await ctx.db.delete(args.matchId);
  },
});

// Get single match (for detail view and sharing)
export const getMatch = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.matchId);
  },
});

// Get shareable match (public access)
export const getShareableMatch = query({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);

    if (!match || !match.shareable) {
      throw new Error("Gedeelde wedstrijd niet gevonden");
    }

    return match;
  },
});

// Find duplicate matches by team name and opponent
export const findDuplicateMatches = query({
  args: { teamName: v.string(), opponent: v.string() },
  handler: async (ctx, args) => {
    const allMatches = await ctx.db.query("matches").collect();

    const duplicates = allMatches.filter(
      (match) =>
        match.team_name === args.teamName &&
        match.opponent === args.opponent
    );

    // Sort by date to help identify which to keep
    return duplicates.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  },
});
