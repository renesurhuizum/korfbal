import { query } from "./_generated/server";

export const countAll = query({
  args: {},
  handler: async (ctx) => {
    const teams = await ctx.db.query("teams").collect();
    const matches = await ctx.db.query("matches").collect();

    return {
      teams: teams.length,
      matches: matches.length,
      teamsData: teams.map(t => ({ name: t.team_name, id: t._id, players: t.players.length })),
      matchesData: matches.map(m => ({
        team: m.team_name,
        opponent: m.opponent,
        date: m.date,
        teamId: m.team_id
      }))
    };
  },
});
