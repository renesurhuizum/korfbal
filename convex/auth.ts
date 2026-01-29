import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Login mutation
export const login = mutation({
  args: {
    team_name: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Special handling for God Mode
    if (args.team_name === "ADMIN" && args.password === "korfbal2026") {
      return {
        teamId: "god-mode" as any,
        teamName: "ADMIN",
        isGodMode: true,
      };
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_team_name", (q) => q.eq("team_name", args.team_name))
      .first();

    if (!team) {
      throw new Error(`Team "${args.team_name}" bestaat niet. Registreer eerst een nieuw team.`);
    }

    if (team.password_hash !== args.password) {
      throw new Error("Onjuist wachtwoord voor dit team");
    }

    return {
      teamId: team._id,
      teamName: team.team_name,
      isGodMode: false,
    };
  },
});

// Register mutation
export const register = mutation({
  args: {
    team_name: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Validation
    if (args.team_name.length < 2) {
      throw new Error("Teamnaam moet minimaal 2 tekens zijn");
    }
    if (args.password.length < 3) {
      throw new Error("Wachtwoord moet minimaal 3 tekens zijn");
    }
    if (args.team_name === "ADMIN") {
      throw new Error("Deze teamnaam is gereserveerd");
    }

    // Check for existing team
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_team_name", (q) => q.eq("team_name", args.team_name))
      .first();

    if (existing) {
      throw new Error(`Team "${args.team_name}" bestaat al. Gebruik een andere naam of log in.`);
    }

    // Create team
    const teamId = await ctx.db.insert("teams", {
      team_name: args.team_name,
      password_hash: args.password,
      players: [],
    });

    return {
      teamId,
      teamName: args.team_name,
      isGodMode: false,
    };
  },
});
