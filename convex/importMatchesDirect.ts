import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Directly import all 4 historical matches
export const importHistoricalMatches = mutation({
  args: {},
  handler: async (ctx) => {
    // Get team IDs
    const dts2 = await ctx.db.query("teams").withIndex("by_team_name", (q) => q.eq("team_name", "DTS2")).first();
    const u19 = await ctx.db.query("teams").withIndex("by_team_name", (q) => q.eq("team_name", "U19")).first();

    if (!dts2 || !u19) {
      throw new Error("Teams not found");
    }

    const matches = [
      {
        team_id: u19._id,
        team_name: "U19",
        opponent: "AVO U19-2",
        date: "2026-01-24T11:00:00.000Z",
        score: 9,
        opponent_score: 14,
        finished: true,
        shareable: false,
      },
      {
        team_id: dts2._id,
        team_name: "DTS2",
        opponent: "WSS 2",
        date: "2026-01-25T17:00:00.000Z",
        score: 20,
        opponent_score: 17,
        finished: true,
        shareable: false,
      },
      {
        team_id: dts2._id,
        team_name: "DTS2",
        opponent: "test",
        date: "2026-01-27T10:57:52.000Z",
        score: 16,
        opponent_score: 3,
        finished: true,
        shareable: false,
      },
      {
        team_id: u19._id,
        team_name: "U19",
        opponent: "test 2",
        date: "2026-01-27T14:54:41.000Z",
        score: 1,
        opponent_score: 0,
        finished: true,
        shareable: false,
      },
    ];

    const inserted = [];

    for (const matchData of matches) {
      // Check if already exists
      const existing = await ctx.db
        .query("matches")
        .withIndex("by_team_id", (q) => q.eq("team_id", matchData.team_id))
        .filter((q) =>
          q.and(
            q.eq(q.field("opponent"), matchData.opponent),
            q.eq(q.field("date"), matchData.date)
          )
        )
        .first();

      if (!existing) {
        const id = await ctx.db.insert("matches", {
          ...matchData,
          players: [],
          opponent_goals: [],
        });
        inserted.push(id);
      }
    }

    return {
      inserted: inserted.length,
      ids: inserted,
    };
  },
});
