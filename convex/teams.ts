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

// Clean duplicate teams: per team name, keep the one with the most matches, delete the rest
export const cleanDuplicateTeams = mutation({
  args: {},
  handler: async (ctx) => {
    const allTeams = await ctx.db.query("teams").collect();
    const allMatches = await ctx.db.query("matches").collect();

    // Group teams by name
    const byName: Record<string, typeof allTeams> = {};
    for (const team of allTeams) {
      const name = team.team_name;
      if (!byName[name]) byName[name] = [];
      byName[name].push(team);
    }

    let deletedTeams = 0;
    let deletedMatches = 0;

    for (const [, group] of Object.entries(byName)) {
      if (group.length <= 1) continue;

      // Sort: most matches first
      const withCounts = group.map(team => ({
        team,
        matchCount: allMatches.filter(m => m.team_id === team._id).length,
      }));
      withCounts.sort((a, b) => b.matchCount - a.matchCount);

      // Keep index 0, delete the rest
      for (const { team } of withCounts.slice(1)) {
        const teamMatches = allMatches.filter(m => m.team_id === team._id);
        for (const match of teamMatches) {
          await ctx.db.delete(match._id);
          deletedMatches++;
        }
        await ctx.db.delete(team._id);
        deletedTeams++;
      }
    }

    return { deletedTeams, deletedMatches };
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
