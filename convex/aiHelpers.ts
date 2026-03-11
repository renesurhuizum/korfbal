import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Persist generated advice — only called internally from the ai action
export const saveAdvice = internalMutation({
  args: {
    teamId: v.id("teams"),
    advice: v.string(),
    matchCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ai_advice")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("ai_advice", {
      teamId: args.teamId,
      advice: args.advice,
      generatedAt: Date.now(),
      basedOnMatchCount: args.matchCount,
    });
  },
});
