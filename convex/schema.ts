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
    outstart: shotStatsValidator,
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
    password_hash: v.string(), // TODO: Consider bcrypt in future
    players: v.array(playerValidator),
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
});
