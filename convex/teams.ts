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

// Clean duplicate teams (God mode) - keeps team with most matches per name, deletes the rest
export const cleanDuplicateTeams = mutation({
  args: {},
  handler: async (ctx) => {
    const allTeams = await ctx.db.query("teams").collect();
    const allMatches = await ctx.db.query("matches").collect();

    // Group teams by name
    const byName = new Map<string, typeof allTeams>();
    for (const team of allTeams) {
      const key = team.team_name.toLowerCase().trim();
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(team);
    }

    let deleted = 0;
    for (const [, group] of byName) {
      if (group.length <= 1) continue;

      // Keep the team with the most matches; on tie keep most recently created
      const ranked = group
        .map(t => ({ team: t, matchCount: allMatches.filter(m => m.team_id === t._id).length }))
        .sort((a, b) => b.matchCount - a.matchCount || b.team._creationTime - a.team._creationTime);

      // Delete all but the first (best) one
      for (const { team } of ranked.slice(1)) {
        const teamMatches = allMatches.filter(m => m.team_id === team._id);
        for (const match of teamMatches) {
          await ctx.db.delete(match._id);
        }
        await ctx.db.delete(team._id);
        deleted++;
      }
    }

    return { deleted };
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
