import { mutation } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

// Check if a string is already a bcrypt hash
function isBcryptHash(str: string): boolean {
  return str.startsWith("$2a$") || str.startsWith("$2b$") || str.startsWith("$2y$");
}

// Login mutation
export const login = mutation({
  args: {
    team_name: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // God Mode — credentials from env var with hardcoded fallback
    const godModePassword = process.env.CONVEX_GOD_MODE_PASSWORD ?? "korfbal2026";
    if (args.team_name === "ADMIN" && args.password === godModePassword) {
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

    // Lazy migration: if stored as plaintext, verify + upgrade to bcrypt hash
    if (!isBcryptHash(team.password_hash)) {
      if (team.password_hash !== args.password) {
        throw new Error("Onjuist wachtwoord voor dit team");
      }
      // Upgrade plaintext password to bcrypt hash
      const newHash = await bcrypt.hash(args.password, BCRYPT_ROUNDS);
      await ctx.db.patch(team._id, { password_hash: newHash });
    } else {
      const valid = await bcrypt.compare(args.password, team.password_hash);
      if (!valid) {
        throw new Error("Onjuist wachtwoord voor dit team");
      }
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
    if (args.team_name.length < 2) {
      throw new Error("Teamnaam moet minimaal 2 tekens zijn");
    }
    if (args.password.length < 3) {
      throw new Error("Wachtwoord moet minimaal 3 tekens zijn");
    }
    if (args.team_name === "ADMIN") {
      throw new Error("Deze teamnaam is gereserveerd");
    }

    const existing = await ctx.db
      .query("teams")
      .withIndex("by_team_name", (q) => q.eq("team_name", args.team_name))
      .first();

    if (existing) {
      throw new Error(`Team "${args.team_name}" bestaat al. Gebruik een andere naam of log in.`);
    }

    const passwordHash = await bcrypt.hash(args.password, BCRYPT_ROUNDS);

    const teamId = await ctx.db.insert("teams", {
      team_name: args.team_name,
      password_hash: passwordHash,
      players: [],
    });

    return {
      teamId,
      teamName: args.team_name,
      isGodMode: false,
    };
  },
});

// Admin mutation: migrate all existing plaintext passwords to bcrypt hashes
// Call this once via God Mode after deploying
export const migratePasswords = mutation({
  args: {
    adminPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const godModePassword = process.env.CONVEX_GOD_MODE_PASSWORD ?? "korfbal2026";
    if (args.adminPassword !== godModePassword) {
      throw new Error("Ongeautoriseerd");
    }

    const teams = await ctx.db.query("teams").collect();
    let migrated = 0;

    for (const team of teams) {
      if (!isBcryptHash(team.password_hash)) {
        const newHash = await bcrypt.hash(team.password_hash, BCRYPT_ROUNDS);
        await ctx.db.patch(team._id, { password_hash: newHash });
        migrated++;
      }
    }

    return { migrated, total: teams.length };
  },
});

// Change password mutation
export const changePassword = mutation({
  args: {
    teamId: v.id("teams"),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 3) {
      throw new Error("Nieuw wachtwoord moet minimaal 3 tekens zijn");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team niet gevonden");
    }

    // Verify current password
    let valid = false;
    if (isBcryptHash(team.password_hash)) {
      valid = await bcrypt.compare(args.currentPassword, team.password_hash);
    } else {
      valid = team.password_hash === args.currentPassword;
    }

    if (!valid) {
      throw new Error("Huidig wachtwoord klopt niet");
    }

    const newHash = await bcrypt.hash(args.newPassword, BCRYPT_ROUNDS);
    await ctx.db.patch(args.teamId, { password_hash: newHash });

    return { success: true };
  },
});
