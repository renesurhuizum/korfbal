import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all teams (God mode)
export const getAllTeams = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teams").collect();
  },
});

// Get team by ID
export const getTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.teamId);
  },
});

// Update team players
export const updatePlayers = mutation({
  args: {
    teamId: v.id("teams"),
    players: v.array(
      v.object({
        id: v.union(v.string(), v.number()),
        name: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.teamId, {
      players: args.players,
    });
  },
});

// Delete team (God mode) - also deletes all matches
export const deleteTeam = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    // Delete all matches for this team first
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_team_id", (q) => q.eq("team_id", args.teamId))
      .collect();

    for (const match of matches) {
      await ctx.db.delete(match._id);
    }

    // Delete team
    await ctx.db.delete(args.teamId);
  },
});
