import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Player validator (used in arrays)
const playerValidator = v.object({
  id: v.union(v.string(), v.number()), // String (new) or number (legacy)
  name: v.string(),
});

// Shot stats validator
const shotStatsValidator = v.object({
  goals: v.number(),
  attempts: v.number(),
});

// Player with stats validator (for matches)
const playerWithStatsValidator = v.object({
  id: v.union(v.string(), v.number()), // String (new) or number (legacy)
  name: v.string(),
  isStarter: v.boolean(),
  stats: v.object({
    distance: shotStatsValidator,
    close: shotStatsValidator,
    penalty: shotStatsValidator,
    freeball: shotStatsValidator,
    runthrough: shotStatsValidator,
    outstart: v.optional(shotStatsValidator), // Optional for legacy matches without outstart
    other: shotStatsValidator,
  }),
});

// Goal validator (chronological goals tracking)
const goalValidator = v.object({
  playerId: v.union(v.string(), v.number()), // String (new) or number (legacy)
  playerName: v.string(),
  shotType: v.string(),
  timestamp: v.string(),
  isOwn: v.boolean(),
});

// Opponent goal validator
const opponentGoalValidator = v.object({
  type: v.string(), // Shot type ID
  time: v.string(), // ISO timestamp
  concededBy: v.string(), // Player name
});

export default defineSchema({
  teams: defineTable({
    team_name: v.string(),
    password_hash: v.string(), // bcrypt hash (see convex/auth.ts)
    players: v.array(playerValidator),
    // Fase 1 preparation: track if team has been migrated to email auth
    migrated: v.optional(v.boolean()),
  })
    .index("by_team_name", ["team_name"]), // For login lookups

  matches: defineTable({
    team_id: v.id("teams"), // Convex ID reference
    team_name: v.string(), // Denormalized for queries
    opponent: v.string(),
    date: v.string(), // ISO timestamp
    players: v.array(playerWithStatsValidator),
    score: v.number(),
    opponent_score: v.number(),
    opponent_goals: v.array(opponentGoalValidator),
    goals: v.optional(v.array(goalValidator)), // Chronological tracking (new feature)
    finished: v.boolean(),
    shareable: v.optional(v.boolean()), // For public sharing
  })
    .index("by_team_id", ["team_id"])
    .index("by_team_and_date", ["team_id", "date"])
    .index("by_shareable", ["shareable"]), // For public match viewing

  // === Fase 1: Email authenticatie (te activeren met @convex-dev/auth) ===
  // Requires: npm install @convex-dev/auth resend
  // Requires: npx convex env set AUTH_RESEND_KEY <key>

  users: defineTable({
    email: v.string(),
    emailVerified: v.optional(v.boolean()),
    name: v.optional(v.string()),
    // User preferences (Fase 3)
    preferences: v.optional(v.object({
      theme: v.optional(v.string()),    // "red" | "orange" | "blue" | "green" | "purple"
      language: v.optional(v.string()), // "nl" | "en" (toekomstig)
    })),
  }).index("by_email", ["email"]),

  passwordResetTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  }).index("by_token", ["token"]),

  // === Fase 2: Multi-user teams ===

  team_members: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
    joinedAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_team_and_user", ["teamId", "userId"]),

  team_invites: defineTable({
    teamId: v.id("teams"),
    token: v.string(),
    createdBy: v.id("users"),
    expiresAt: v.number(),
    usedCount: v.number(),
  }).index("by_token", ["token"]),

  // === Fase 6: AI Trainingsadvies ===

  ai_advice: defineTable({
    teamId: v.id("teams"),
    advice: v.string(),
    generatedAt: v.number(),
    basedOnMatchCount: v.number(),
  }).index("by_team", ["teamId"]),
});
