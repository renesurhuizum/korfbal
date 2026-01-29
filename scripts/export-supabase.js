import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalents of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportData() {
  console.log('🚀 Starting Supabase data export...\n');

  // Create export directory if it doesn't exist
  const exportDir = path.join(__dirname, '..', 'export');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  try {
    // Export teams
    console.log('📦 Exporting teams...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*');

    if (teamsError) throw teamsError;

    const teamsPath = path.join(exportDir, 'teams.json');
    fs.writeFileSync(teamsPath, JSON.stringify(teams, null, 2));
    console.log(`✓ Exported ${teams.length} teams to ${teamsPath}`);

    // Export matches
    console.log('\n📦 Exporting matches...');
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*');

    if (matchesError) throw matchesError;

    const matchesPath = path.join(exportDir, 'matches.json');
    fs.writeFileSync(matchesPath, JSON.stringify(matches, null, 2));
    console.log(`✓ Exported ${matches.length} matches to ${matchesPath}`);

    // Summary
    console.log('\n✅ Export complete!');
    console.log(`\nSummary:`);
    console.log(`  Teams: ${teams.length}`);
    console.log(`  Matches: ${matches.length}`);
    console.log(`\nNext step: Run the transform script`);
    console.log(`  node scripts/transform-data.js`);
  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    process.exit(1);
  }
}

exportData();
