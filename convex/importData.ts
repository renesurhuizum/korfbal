import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Import teams - run first, or get existing teams
export const importTeams = mutation({
  args: {
    teams: v.any(), // Array of teams from Supabase
  },
  handler: async (ctx, args) => {
    const teamIds: Array<{ name: string; id: any }> = [];

    for (const team of args.teams) {
      try {
        // Check if team already exists
        const existingTeam = await ctx.db
          .query("teams")
          .withIndex("by_team_name", (q) => q.eq("team_name", team.team_name))
          .first();

        if (existingTeam) {
          // Team exists, use existing ID and update players if needed
          await ctx.db.patch(existingTeam._id, {
            players: team.players || [],
          });
          teamIds.push({ name: team.team_name, id: existingTeam._id });
          console.log(`✓ Found existing team: ${team.team_name}`);
        } else {
          // Create new team
          const teamId = await ctx.db.insert("teams", {
            team_name: team.team_name,
            password_hash: team.password_hash,
            players: team.players || [],
          });
          teamIds.push({ name: team.team_name, id: teamId });
          console.log(`✓ Imported new team: ${team.team_name}`);
        }
      } catch (error) {
        console.error(`✗ Failed to import team ${team.team_name}:`, error);
      }
    }

    return {
      imported: teamIds.length,
      teamIds,
    };
  },
});

// Import matches - run after teams
export const importMatches = mutation({
  args: {
    matches: v.any(), // Array of matches from Supabase
    teamIdMap: v.any(), // Map of team_name to Convex ID
  },
  handler: async (ctx, args) => {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    console.log(`Starting import of ${args.matches.length} matches`);
    console.log(`Team ID map:`, args.teamIdMap);

    for (const match of args.matches) {
      console.log(`\nProcessing match: ${match.team_name} vs ${match.opponent}`);
      const teamId = args.teamIdMap[match.team_name];

      if (!teamId) {
        console.warn(`Skipping match - team not found: ${match.team_name}`);
        skipped++;
        errors.push(`Team not found: ${match.team_name}`);
        continue;
      }

      console.log(`Team ID found: ${teamId}`);

      try {
        // Check if match already exists (by team, opponent, and date)
        const existingMatch = await ctx.db
          .query("matches")
          .withIndex("by_team_id", (q) => q.eq("team_id", teamId))
          .filter((q) =>
            q.and(
              q.eq(q.field("opponent"), match.opponent),
              q.eq(q.field("date"), match.date)
            )
          )
          .first();

        if (existingMatch) {
          console.log(
            `○ Match already exists: ${match.team_name} vs ${match.opponent}`
          );
          skipped++;
          continue; // Skip if already exists
        }

        console.log(`No existing match found, inserting...`);

        const matchData: any = {
          team_id: teamId,
          team_name: match.team_name,
          opponent: match.opponent,
          date: match.date,
          players: match.players || [],
          score: match.score || 0,
          opponent_score: match.opponent_score || 0,
          opponent_goals: match.opponent_goals || [],
          finished: match.finished !== false,
          shareable: match.shareable || false,
        };

        // Only add goals if it's not null/undefined
        if (match.goals !== null && match.goals !== undefined) {
          matchData.goals = match.goals;
        }

        const insertedId = await ctx.db.insert("matches", matchData);
        console.log(`✓ Inserted match ID: ${insertedId}`);

        imported++;
        console.log(
          `✓ Imported match: ${match.team_name} vs ${match.opponent} (${match.date})`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `✗ Failed to import match ${match.team_name} vs ${match.opponent}:`,
          errorMsg
        );
        skipped++;
        errors.push(
          `Failed: ${match.team_name} vs ${match.opponent} - ${errorMsg}`
        );
      }
    }

    return {
      imported,
      skipped,
      errors: errors.slice(0, 10), // First 10 errors only
    };
  },
});
