import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper: get verified identity or throw
async function requireAuth(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Niet ingelogd");
  return identity;
}

// Helper: verify membership, optionally require admin role
async function requireMember(ctx: any, teamId: any, requireAdmin = false) {
  const identity = await requireAuth(ctx);
  const member = await ctx.db
    .query("team_members")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", teamId).eq("userId", identity.subject)
    )
    .first();
  if (!member) throw new Error("Geen toegang tot dit team");
  if (requireAdmin && member.role !== "admin")
    throw new Error("Beheerder-rechten vereist");
  return { member, identity };
}

// ─── Queries ────────────────────────────────────────────────

// Get all teams the current user belongs to
export const getUserTeams = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const memberships = await ctx.db
      .query("team_members")
      .withIndex("by_user_id", (q: any) => q.eq("userId", identity.subject))
      .collect();

    const teams = await Promise.all(
      memberships.map(async (m: any) => {
        const team = await ctx.db.get(m.teamId);
        if (!team) return null;
        return {
          teamId: m.teamId,
          teamName: team.team_name,
          role: m.role,
          joinedAt: m.joinedAt,
        };
      })
    );

    return teams.filter(Boolean);
  },
});

// Get team members (admin or member can view)
export const getTeamMembers = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Verify caller is a member
    const callerMembership = await ctx.db
      .query("team_members")
      .withIndex("by_team_and_user", (q: any) =>
        q.eq("teamId", args.teamId).eq("userId", identity.subject)
      )
      .first();
    if (!callerMembership) return [];

    const members = await ctx.db
      .query("team_members")
      .withIndex("by_team_id", (q: any) => q.eq("teamId", args.teamId))
      .collect();

    return members.map((m: any) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      displayName: m.displayName || "Onbekend",
      isCurrentUser: m.userId === identity.subject,
    }));
  },
});

// ─── Mutations ──────────────────────────────────────────────

// Create a new team and make the caller admin
export const createTeam = mutation({
  args: { teamName: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    if (args.teamName.length < 2)
      throw new Error("Teamnaam moet minimaal 2 tekens zijn");
    if (args.teamName === "ADMIN")
      throw new Error("Deze teamnaam is gereserveerd");

    const existing = await ctx.db
      .query("teams")
      .withIndex("by_team_name", (q: any) => q.eq("team_name", args.teamName))
      .first();
    if (existing) throw new Error(`Team "${args.teamName}" bestaat al`);

    const teamId = await ctx.db.insert("teams", {
      team_name: args.teamName,
      players: [],
      migrated: true, // Created via Clerk — no password needed
    });

    await ctx.db.insert("team_members", {
      teamId,
      userId: identity.subject,
      role: "admin",
      joinedAt: Date.now(),
      displayName: identity.name || identity.email || "Coach",
    });

    return { teamId, teamName: args.teamName };
  },
});

// Claim an existing team using the old team password (migration flow)
export const claimTeam = mutation({
  args: {
    teamName: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const team = await ctx.db
      .query("teams")
      .withIndex("by_team_name", (q: any) => q.eq("team_name", args.teamName))
      .first();

    if (!team) throw new Error(`Team "${args.teamName}" bestaat niet`);
    if (team.migrated) throw new Error("Dit team is al geclaimd");

    // Verify old PBKDF2 or plaintext password
    const stored = team.password_hash;
    if (!stored) throw new Error("Dit team heeft geen wachtwoord meer");

    let valid = false;
    if (stored.startsWith("pbkdf2:")) {
      valid = await verifyPBKDF2(args.password, stored);
    } else if (!stored.startsWith("$2")) {
      // Legacy plaintext
      valid = stored === args.password;
    }

    if (!valid) throw new Error("Onjuist wachtwoord voor dit team");

    // Check if already a member
    const existing = await ctx.db
      .query("team_members")
      .withIndex("by_team_and_user", (q: any) =>
        q.eq("teamId", team._id).eq("userId", identity.subject)
      )
      .first();
    if (existing) throw new Error("Je bent al lid van dit team");

    // Add as admin and mark team as migrated
    await ctx.db.insert("team_members", {
      teamId: team._id,
      userId: identity.subject,
      role: "admin",
      joinedAt: Date.now(),
      displayName: identity.name || identity.email || "Coach",
    });

    await ctx.db.patch(team._id, { migrated: true });

    return { teamId: team._id, teamName: team.team_name };
  },
});

// Generate an invite link (admin only)
export const generateInvite = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.teamId, true); // admin only

    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    // Upsert: remove old invite for this team first
    const old = await ctx.db
      .query("team_invites")
      .filter((q: any) => q.eq(q.field("teamId"), args.teamId))
      .first();
    if (old) await ctx.db.delete(old._id);

    await ctx.db.insert("team_invites", {
      teamId: args.teamId,
      token,
      createdBy: (await ctx.auth.getUserIdentity())!.subject,
      expiresAt,
      usedCount: 0,
    });

    return { token };
  },
});

// Accept an invite (join as member)
export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const invite = await ctx.db
      .query("team_invites")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();

    if (!invite) throw new Error("Uitnodigingslink ongeldig");
    if (invite.expiresAt < Date.now())
      throw new Error("Uitnodigingslink is verlopen");

    // Check if already a member
    const existing = await ctx.db
      .query("team_members")
      .withIndex("by_team_and_user", (q: any) =>
        q.eq("teamId", invite.teamId).eq("userId", identity.subject)
      )
      .first();

    if (existing) {
      // Already a member — just return the teamId
      return { teamId: invite.teamId };
    }

    await ctx.db.insert("team_members", {
      teamId: invite.teamId,
      userId: identity.subject,
      role: "member",
      joinedAt: Date.now(),
      displayName: identity.name || identity.email || "Lid",
    });

    await ctx.db.patch(invite._id, { usedCount: invite.usedCount + 1 });

    return { teamId: invite.teamId };
  },
});

// Remove a member (admin only; cannot remove self)
export const removeMember = mutation({
  args: {
    teamId: v.id("teams"),
    targetUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireMember(ctx, args.teamId, true);

    if (identity.subject === args.targetUserId)
      throw new Error("Je kunt jezelf niet verwijderen");

    const member = await ctx.db
      .query("team_members")
      .withIndex("by_team_and_user", (q: any) =>
        q.eq("teamId", args.teamId).eq("userId", args.targetUserId)
      )
      .first();

    if (!member) throw new Error("Lid niet gevonden");
    await ctx.db.delete(member._id);
  },
});

// ─── Internal: PBKDF2 verification (for claimTeam) ──────────

async function verifyPBKDF2(password: string, stored: string): Promise<boolean> {
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
    { name: "PBKDF2", salt, hash: "SHA-256", iterations: 100000 },
    keyMaterial,
    256
  );
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  return stored === `pbkdf2:${saltB64}:${hashB64}`;
}
