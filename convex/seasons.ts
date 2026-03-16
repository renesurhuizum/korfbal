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

// Get all seasons for a team, sorted by createdAt descending
export const getSeasons = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const seasons = await ctx.db
      .query("seasons")
      .withIndex("by_team_id", (q) => q.eq("teamId", args.teamId))
      .collect();
    return seasons.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Create a new season and deactivate all others
export const createSeason = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.teamId);

    // Deactivate all existing active seasons for this team
    const existing = await ctx.db
      .query("seasons")
      .withIndex("by_team_id", (q) => q.eq("teamId", args.teamId))
      .collect();
    for (const season of existing) {
      if (season.isActive) {
        await ctx.db.patch(season._id, { isActive: false });
      }
    }

    const seasonId = await ctx.db.insert("seasons", {
      teamId: args.teamId,
      name: args.name.trim(),
      isActive: true,
      createdAt: Date.now(),
    });

    return seasonId;
  },
});

// Close (archive) a season
export const closeSeason = mutation({
  args: {
    seasonId: v.id("seasons"),
  },
  handler: async (ctx, args) => {
    const season = await ctx.db.get(args.seasonId);
    if (!season) throw new Error("Seizoen niet gevonden");
    await requireMember(ctx, season.teamId);
    await ctx.db.patch(args.seasonId, { isActive: false });
  },
});
