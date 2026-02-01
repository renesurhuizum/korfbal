import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
    const matchId = await ctx.db.insert("matches", {
      team_id: args.teamId,
      team_name: args.teamName,
      opponent: args.opponent,
      date: args.date,
      players: args.players,
      score: args.score,
      opponent_score: args.opponentScore,
      opponent_goals: args.opponentGoals || [],
      goals: args.goals,
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
    const updates: any = {};

    if (args.shareable !== undefined) {
      updates.shareable = args.shareable;
    }

    if (args.goals !== undefined) {
      updates.goals = args.goals;
    }

    await ctx.db.patch(args.matchId, updates);
  },
});

// Delete match
export const deleteMatch = mutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, args) => {
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
