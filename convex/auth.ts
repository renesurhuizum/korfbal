import { mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── NOTE ────────────────────────────────────────────────────────────────────
// Authentication is now handled by Clerk (Fase 1+2).
// This file only contains the God Mode login for admin access.
// Team creation / claiming is handled by convex/memberships.ts.
// ─────────────────────────────────────────────────────────────────────────────

// God Mode login — used by the admin dashboard only
// Normal user authentication goes through Clerk.
export const login = mutation({
  args: {
    team_name: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // God Mode only — normal teams no longer use password-based login
    const godModePassword = process.env.CONVEX_GOD_MODE_PASSWORD ?? "korfbal2026";
    if (args.team_name === "ADMIN" && args.password === godModePassword) {
      return {
        teamId: "god-mode" as any,
        teamName: "ADMIN",
        isGodMode: true,
      };
    }

    throw new Error("Gebruik je e-mailadres om in te loggen");
  },
});
