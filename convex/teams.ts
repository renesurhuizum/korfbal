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

// Reset password (God mode)
export const resetPassword = mutation({
  args: {
    teamId: v.id("teams"),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 3) {
      throw new Error("Wachtwoord moet minimaal 3 tekens zijn");
    }
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team niet gevonden");
    await ctx.db.patch(args.teamId, { password_hash: args.newPassword });
  },
});

// Rename team (God mode)
export const renameTeam = mutation({
  args: {
    teamId: v.id("teams"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.newName.length < 2) {
      throw new Error("Teamnaam moet minimaal 2 tekens zijn");
    }
    if (args.newName === "ADMIN") {
      throw new Error("Deze teamnaam is gereserveerd");
    }
    // Check for existing team with this name (excluding self)
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_team_name", (q) => q.eq("team_name", args.newName))
      .first();
    if (existing && existing._id !== args.teamId) {
      throw new Error(`Team "${args.newName}" bestaat al`);
    }
    // Update team name
    await ctx.db.patch(args.teamId, { team_name: args.newName });
    // Update denormalized team_name on all matches
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_team_id", (q) => q.eq("team_id", args.teamId))
      .collect();
    for (const match of matches) {
      await ctx.db.patch(match._id, { team_name: args.newName });
    }
  },
});

// Merge teams (God mode) - move all data from source to target, delete source
export const mergeTeams = mutation({
  args: {
    targetTeamId: v.id("teams"),
    sourceTeamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    if (args.targetTeamId === args.sourceTeamId) {
      throw new Error("Kan niet samenvoegen met zichzelf");
    }
    const target = await ctx.db.get(args.targetTeamId);
    const source = await ctx.db.get(args.sourceTeamId);
    if (!target || !source) throw new Error("Team niet gevonden");

    // Move all matches from source to target
    const sourceMatches = await ctx.db
      .query("matches")
      .withIndex("by_team_id", (q) => q.eq("team_id", args.sourceTeamId))
      .collect();
    for (const match of sourceMatches) {
      await ctx.db.patch(match._id, {
        team_id: args.targetTeamId,
        team_name: target.team_name,
      });
    }

    // Merge players (deduplicate by name, case-insensitive)
    const existingNames = new Set(
      target.players.map((p: any) => p.name.toLowerCase())
    );
    const newPlayers = source.players.filter(
      (p: any) => !existingNames.has(p.name.toLowerCase())
    );
    if (newPlayers.length > 0) {
      await ctx.db.patch(args.targetTeamId, {
        players: [...target.players, ...newPlayers],
      });
    }

    // Delete the source team
    await ctx.db.delete(args.sourceTeamId);

    return {
      matchesMoved: sourceMatches.length,
      playersMerged: newPlayers.length,
    };
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
