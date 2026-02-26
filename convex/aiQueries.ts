// Separate file — NO "use node;" so queries run in the standard V8 runtime
import { query } from "./_generated/server";
import { v } from "convex/values";

// Read cached training advice for a team
export const getAdvice = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ai_advice")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .first();
  },
});
