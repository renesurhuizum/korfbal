import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function transformData() {
  console.log('🔄 Starting data transformation...\n');

  const exportDir = path.join(__dirname, '..', 'export');

  // Check if export files exist
  const teamsPath = path.join(exportDir, 'teams.json');
  const matchesPath = path.join(exportDir, 'matches.json');

  if (!fs.existsSync(teamsPath)) {
    console.error('❌ teams.json not found. Run export-supabase.js first.');
    process.exit(1);
  }

  if (!fs.existsSync(matchesPath)) {
    console.error('❌ matches.json not found. Run export-supabase.js first.');
    process.exit(1);
  }

  try {
    // Load data
    const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf8'));
    const matches = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));

    console.log(`📊 Loaded ${teams.length} teams and ${matches.length} matches\n`);

    // Transform teams (remove Supabase-specific fields)
    console.log('🔧 Transforming teams...');
    const transformedTeams = teams.map(team => ({
      team_name: team.team_name,
      password_hash: team.password_hash,
      players: team.players || [],
      // Store original ID for reference during matching
      _original_id: team.id,
    }));

    console.log(`✓ Transformed ${transformedTeams.length} teams`);

    // Transform matches (prepare for team_id remapping)
    console.log('\n🔧 Transforming matches...');
    const transformedMatches = matches.map(match => ({
      team_name: match.team_name,
      opponent: match.opponent,
      date: match.date,
      players: match.players || [],
      score: match.score || 0,
      opponent_score: match.opponent_score || 0,
      opponent_goals: match.opponent_goals || [],
      goals: match.goals || null,
      finished: match.finished !== false,
      shareable: match.shareable || false,
      // Store original IDs for reference
      _original_id: match.id,
      _original_team_id: match.team_id,
    }));

    console.log(`✓ Transformed ${transformedMatches.length} matches`);

    // Write transformed data
    const transformedTeamsPath = path.join(exportDir, 'teams-transformed.json');
    const transformedMatchesPath = path.join(exportDir, 'matches-transformed.json');

    fs.writeFileSync(transformedTeamsPath, JSON.stringify(transformedTeams, null, 2));
    fs.writeFileSync(transformedMatchesPath, JSON.stringify(transformedMatches, null, 2));

    // Statistics
    console.log('\n📈 Transformation statistics:');

    // Count matches per team
    const matchesPerTeam = {};
    transformedMatches.forEach(match => {
      matchesPerTeam[match.team_name] = (matchesPerTeam[match.team_name] || 0) + 1;
    });

    console.log(`\n  Teams with matches:`);
    Object.entries(matchesPerTeam)
      .sort((a, b) => b[1] - a[1])
      .forEach(([teamName, count]) => {
        console.log(`    ${teamName}: ${count} match(es)`);
      });

    // Find teams without matches
    const teamsWithoutMatches = transformedTeams.filter(
      team => !matchesPerTeam[team.team_name]
    );

    if (teamsWithoutMatches.length > 0) {
      console.log(`\n  ⚠️  Teams without matches: ${teamsWithoutMatches.length}`);
      teamsWithoutMatches.forEach(team => {
        console.log(`    - ${team.team_name}`);
      });
    }

    console.log('\n✅ Transformation complete!');
    console.log(`\nOutput files:`);
    console.log(`  ${transformedTeamsPath}`);
    console.log(`  ${transformedMatchesPath}`);
    console.log(`\nNext step: Run the import script`);
    console.log(`  node scripts/import-convex.js`);
  } catch (error) {
    console.error('\n❌ Transformation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

transformData();
