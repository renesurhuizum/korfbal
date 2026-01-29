import { mutation } from "./_generated/server";

export const insertTestMatch = mutation({
  args: {},
  handler: async (ctx) => {
    // Get first team
    const team = await ctx.db.query("teams").first();
    if (!team) throw new Error("No teams found");

    // Insert a simple test match
    const matchId = await ctx.db.insert("matches", {
      team_id: team._id,
      team_name: team.team_name,
      opponent: "Test Opponent",
      date: new Date().toISOString(),
      players: [{
        id: 1,
        name: "Test Player",
        isStarter: true,
        stats: {
          distance: { goals: 0, attempts: 0 },
          close: { goals: 0, attempts: 0 },
          penalty: { goals: 0, attempts: 0 },
          freeball: { goals: 0, attempts: 0 },
          runthrough: { goals: 0, attempts: 0 },
          other: { goals: 0, attempts: 0 },
        }
      }],
      score: 0,
      opponent_score: 0,
      opponent_goals: [],
      finished: true,
      shareable: false,
    });

    return { success: true, matchId, teamId: team._id };
  },
});
