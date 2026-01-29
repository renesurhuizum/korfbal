import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Import teams - run first
export const importTeams = mutation({
  args: {
    teams: v.any(), // Array of teams from Supabase
  },
  handler: async (ctx, args) => {
    const teamIds: Array<{ name: string; id: any }> = [];

    for (const team of args.teams) {
      try {
        const teamId = await ctx.db.insert("teams", {
          team_name: team.team_name,
          password_hash: team.password_hash,
          players: team.players || [],
        });
        teamIds.push({ name: team.team_name, id: teamId });
        console.log(`✓ Imported team: ${team.team_name}`);
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

    for (const match of args.matches) {
      const teamId = args.teamIdMap[match.team_name];

      if (!teamId) {
        console.warn(`Skipping match - team not found: ${match.team_name}`);
        skipped++;
        errors.push(`Team not found: ${match.team_name}`);
        continue;
      }

      try {
        await ctx.db.insert("matches", {
          team_id: teamId,
          team_name: match.team_name,
          opponent: match.opponent,
          date: match.date,
          players: match.players || [],
          score: match.score || 0,
          opponent_score: match.opponent_score || 0,
          opponent_goals: match.opponent_goals || [],
          goals: match.goals,
          finished: match.finished !== false,
          shareable: match.shareable || false,
        });

        imported++;
        console.log(
          `✓ Imported match: ${match.team_name} vs ${match.opponent} (${match.date})`
        );
      } catch (error) {
        console.error(
          `✗ Failed to import match ${match.team_name} vs ${match.opponent}:`,
          error
        );
        skipped++;
        errors.push(
          `Failed: ${match.team_name} vs ${match.opponent} - ${error}`
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
