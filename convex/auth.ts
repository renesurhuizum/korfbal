import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Native Web Crypto API — altijd beschikbaar in Convex V8, geen externe bibliotheek nodig

const PBKDF2_ITERATIONS = 100000;
const HASH_PREFIX = "pbkdf2:";

// Hash a password using PBKDF2-SHA256 with a random salt
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, hash: "SHA-256", iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  return `${HASH_PREFIX}${saltB64}:${hashB64}`;
}

// Verify a password against a stored hash
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith(HASH_PREFIX)) {
    // PBKDF2 hash — verify using same salt
    const parts = stored.split(":");
    if (parts.length !== 3) return false;
    const saltB64 = parts[1];
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const hashBuffer = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, hash: "SHA-256", iterations: PBKDF2_ITERATIONS },
      keyMaterial,
      256
    );
    const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    return stored === `${HASH_PREFIX}${saltB64}:${hashB64}`;
  }

  // Legacy: plaintext password (from before hashing was introduced)
  // Verify directly — will be upgraded to PBKDF2 on success
  if (!stored.startsWith("$2")) {
    return stored === password;
  }

  // Legacy: old bcrypt hash — bcryptjs is removed, cannot verify
  // User must re-register to get a PBKDF2 hash
  return false;
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

    const valid = await verifyPassword(args.password, team.password_hash);
    if (!valid) {
      throw new Error("Onjuist wachtwoord voor dit team");
    }

    // Lazy migration: upgrade plaintext to PBKDF2 hash on successful login
    if (!team.password_hash.startsWith(HASH_PREFIX)) {
      const newHash = await hashPassword(args.password);
      await ctx.db.patch(team._id, { password_hash: newHash });
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

    const passwordHash = await hashPassword(args.password);

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

// Admin mutation: migrate all existing plaintext passwords to PBKDF2 hashes
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
      if (!team.password_hash.startsWith(HASH_PREFIX)) {
        const newHash = await hashPassword(team.password_hash);
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

    const valid = await verifyPassword(args.currentPassword, team.password_hash);
    if (!valid) {
      throw new Error("Huidig wachtwoord klopt niet");
    }

    const newHash = await hashPassword(args.newPassword);
    await ctx.db.patch(args.teamId, { password_hash: newHash });

    return { success: true };
  },
});
