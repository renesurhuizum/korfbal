import { ConvexHttpClient } from "convex/browser";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const convexUrl = envVars.VITE_CONVEX_URL;

if (!convexUrl) {
  console.error('❌ Error: Missing VITE_CONVEX_URL in .env file');
  console.error('Add your Convex deployment URL to .env:');
  console.error('  VITE_CONVEX_URL=https://your-deployment.convex.cloud');
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);

async function importData() {
  console.log('🚀 Starting Convex data import...\n');
  console.log(`📡 Connected to: ${convexUrl}\n`);

  const exportDir = path.join(__dirname, '..', 'export');
  const teamsPath = path.join(exportDir, 'teams-transformed.json');
  const matchesPath = path.join(exportDir, 'matches-transformed.json');

  // Check if transformed files exist
  if (!fs.existsSync(teamsPath)) {
    console.error('❌ teams-transformed.json not found. Run transform-data.js first.');
    process.exit(1);
  }

  if (!fs.existsSync(matchesPath)) {
    console.error('❌ matches-transformed.json not found. Run transform-data.js first.');
    process.exit(1);
  }

  try {
    // Load transformed data
    const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf8'));
    const matches = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));

    console.log(`📊 Loaded ${teams.length} teams and ${matches.length} matches\n`);

    // Step 1: Import teams
    console.log('📦 Importing teams to Convex...');

    const teamResult = await client.mutation("importData:importTeams", { teams });

    console.log(`✅ Imported ${teamResult.imported} teams\n`);

    // Step 2: Create team ID mapping
    console.log('🗺️  Creating team ID mapping...');

    const teamIdMap = {};
    teamResult.teamIds.forEach(({ name, id }) => {
      teamIdMap[name] = id;
    });

    console.log(`✓ Mapped ${Object.keys(teamIdMap).length} teams\n`);

    // Step 3: Import matches
    console.log('📦 Importing matches to Convex...');

    const matchResult = await client.mutation("importData:importMatches", {
      matches,
      teamIdMap,
    });

    console.log(`✅ Imported ${matchResult.imported} matches`);

    if (matchResult.skipped > 0) {
      console.log(`⚠️  Skipped ${matchResult.skipped} matches`);
      if (matchResult.errors && matchResult.errors.length > 0) {
        console.log('\nFirst few errors:');
        matchResult.errors.slice(0, 5).forEach(error => {
          console.log(`  - ${error}`);
        });
      }
    }

    // Summary
    console.log('\n✅ Import complete!\n');
    console.log('Summary:');
    console.log(`  Teams imported: ${teamResult.imported}`);
    console.log(`  Matches imported: ${matchResult.imported}`);
    if (matchResult.skipped > 0) {
      console.log(`  Matches skipped: ${matchResult.skipped}`);
    }

    console.log('\n🎉 Migration successful!');
    console.log('\nNext steps:');
    console.log('  1. Test the app with Convex');
    console.log('  2. Verify data in Convex dashboard');
    console.log('  3. Deploy to production');
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

importData();
