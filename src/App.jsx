import React, { useState, useEffect } from 'react';
import { Trophy, Users, BarChart3, Plus, ArrowLeft, Save } from 'lucide-react';
import { supabase } from './supabaseClient';

const SHOT_TYPES = [
  { id: 'distance', label: 'Afstandschot', short: 'AS' },
  { id: 'close', label: 'Kans bij korf', short: 'KK' },
  { id: 'penalty', label: 'Strafworp', short: 'SW' },
  { id: 'freeball', label: 'Vrije bal', short: 'VB' },
  { id: 'runthrough', label: 'Doorloopbal', short: 'DL' },
  { id: 'other', label: 'Overig', short: 'OV' }
];

export default function KorfbalApp() {
  const [view, setView] = useState('login');
  const [currentTeam, setCurrentTeam] = useState(null);
  const [currentTeamId, setCurrentTeamId] = useState(null);
  const [teams, setTeams] = useState([]);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [matches, setMatches] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    if (currentTeamId) {
      loadMatches();
    }
  }, [currentTeamId]);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const showFeedback = (message, type = 'error') => {
    setFeedback({ message, type });
  };

  const loadTeams = async () => {
    try {
      const { data, error } = await supabase.from('teams').select('*');
      if (error) throw error;
      setTeams(data || []);
    } catch (e) {
      console.error('Error loading teams:', e);
    }
  };

  const loadMatches = async () => {
    try {
      const { data, error } = await supabase.from('matches').select('*').eq('team_id', currentTeamId).order('date', { ascending: false });
      if (error) throw error;
      setMatches(data || []);
    } catch (e) {
      console.error('Error loading matches:', e);
      showFeedback('Fout bij laden wedstrijden', 'error');
    }
  };

  const loadAllMatches = async () => {
    try {
      const { data, error } = await supabase.from('matches').select('*').order('date', { ascending: false });
      if (error) throw error;
      setMatches(data || []);
    } catch (e) {
      console.error('Error loading all matches:', e);
      showFeedback('Fout bij laden wedstrijden', 'error');
    }
  };

  const saveTeamPlayers = async (teamId, players) => {
    try {
      const { error } = await supabase.from('teams').update({ players }).eq('id', teamId);
      if (error) throw error;
      // Wait for teams to be reloaded before returning
      await loadTeams();
      return true;
    } catch (e) {
      console.error('Error saving players:', e);
      showFeedback('Fout bij opslaan spelers', 'error');
      return false;
    }
  };

  const saveMatch = async (match) => {
    try {
      const { error } = await supabase.from('matches').insert([{
        team_id: currentTeamId, team_name: currentTeam, opponent: match.opponent, date: match.date,
        players: match.players, score: match.score, opponent_score: match.opponentScore,
        opponent_goals: match.opponentGoals, finished: true
      }]);
      if (error) throw error;
      await loadMatches();
      showFeedback('Wedstrijd opgeslagen', 'success');
      return true;
    } catch (e) {
      console.error('Error saving match:', e);
      showFeedback('Fout bij opslaan wedstrijd', 'error');
      return false;
    }
  };

  const deleteMatch = async (matchId) => {
    try {
      const { error } = await supabase.from('matches').delete().eq('id', matchId);
      if (error) throw error;
      await loadMatches();
      showFeedback('Wedstrijd verwijderd', 'success');
    } catch (e) {
      console.error('Error deleting match:', e);
      showFeedback('Fout bij verwijderen wedstrijd', 'error');
    }
  };
  const LoginView = () => {
    const [teamName, setTeamName] = useState('');
    const [password, setPassword] = useState('');
    const [isNewTeam, setIsNewTeam] = useState(false);
    const [showGodMode, setShowGodMode] = useState(false);

    // Load all matches when God Mode is shown
    useEffect(() => {
      if (showGodMode) {
        loadAllMatches();
      }
    }, [showGodMode]);

    const handleLogin = async () => {
      if (!teamName || !password) {
        showFeedback('Vul beide velden in', 'error');
        return;
      }
      if (teamName === 'ADMIN' && password === 'korfbal2026') {
        setShowGodMode(true);
        return;
      }
      setLoading(true);
      try {
        const { data: team, error } = await supabase.from('teams').select('*').eq('team_name', teamName).single();
        if (error || !team) {
          showFeedback(`Team "${teamName}" bestaat niet. Registreer eerst een nieuw team.`, 'error');
          setLoading(false);
          return;
        }
        if (team.password_hash === password) {
          setCurrentTeam(teamName);
          setCurrentTeamId(team.id);
          setView('home');
          showFeedback(`Welkom ${teamName}!`, 'success');
        } else {
          showFeedback('Onjuist wachtwoord voor dit team', 'error');
        }
      } catch (e) {
        showFeedback('Fout bij inloggen', 'error');
      }
      setLoading(false);
    };

    const handleRegister = async () => {
      if (!teamName || !password) {
        showFeedback('Vul beide velden in', 'error');
        return;
      }
      if (teamName.length < 2) {
        showFeedback('Teamnaam moet minimaal 2 tekens zijn', 'error');
        return;
      }
      if (password.length < 3) {
        showFeedback('Wachtwoord moet minimaal 3 tekens zijn', 'error');
        return;
      }
      if (teamName === 'ADMIN') {
        showFeedback('Deze teamnaam is gereserveerd', 'error');
        return;
      }
      setLoading(true);
      try {
        const { data: existing } = await supabase.from('teams').select('id').eq('team_name', teamName).single();
        if (existing) {
          showFeedback(`Team "${teamName}" bestaat al. Gebruik een andere naam of log in.`, 'error');
          setLoading(false);
          return;
        }
        const { data: newTeam, error } = await supabase.from('teams').insert([{
          team_name: teamName, password_hash: password, players: []
        }]).select().single();
        if (error) throw error;
        setCurrentTeam(teamName);
        setCurrentTeamId(newTeam.id);
        await loadTeams();
        setView('home');
        showFeedback(`Team "${teamName}" succesvol aangemaakt!`, 'success');
      } catch (e) {
        showFeedback('Fout bij registreren', 'error');
      }
      setLoading(false);
    };

    if (showGodMode) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-yellow-600 to-yellow-800 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">👑 God Mode</h1>
              <button onClick={() => setShowGodMode(false)} className="text-gray-600 hover:text-gray-800">✕ Sluiten</button>
            </div>
            <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-600 rounded">
              <p className="font-semibold text-yellow-800">Totaal aantal teams: {teams.length}</p>
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800">Alle teams:</h2>
              {teams.length === 0 ? <p className="text-gray-600">Nog geen teams</p> : (
                <div className="space-y-3">
                  {teams.map((team) => {
                    const teamMatches = matches.filter(m => m.team_id === team.id);
                    return (
                      <div key={team.id} className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg">{team.team_name}</h3>
                            <div className="mt-2 space-y-1 text-sm text-gray-600">
                              <p>ID: {team.id}</p>
                              <p>Spelers: {team.players?.length || 0}</p>
                              <p>Wedstrijden: {teamMatches.length}</p>
                              {team.created_at && (
                                <p>Aangemaakt: {new Date(team.created_at).toLocaleDateString('nl-NL', { 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}</p>
                              )}
                            </div>
                          </div>
                          <button onClick={async () => {
                            if (confirm(`Team "${team.team_name}" verwijderen? Dit verwijdert ook alle wedstrijden van dit team.`)) {
                              try {
                                // First delete all matches for this team
                                await supabase.from('matches').delete().eq('team_id', team.id);
                                // Then delete the team
                                await supabase.from('teams').delete().eq('id', team.id);
                                await loadTeams();
                                await loadAllMatches();
                                showFeedback('Team en wedstrijden verwijderd', 'success');
                              } catch (e) {
                                showFeedback('Fout bij verwijderen', 'error');
                              }
                            }
                          }} className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 ml-4">
                            Verwijder
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <Trophy className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800">Korfbal Score App</h1>
          </div>
          <div className="space-y-4">
            <input type="text" placeholder="Teamnaam" value={teamName} onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:outline-none" />
            <input type="password" placeholder="Wachtwoord" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (isNewTeam ? handleRegister() : handleLogin())}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:outline-none" />
            <button onClick={isNewTeam ? handleRegister : handleLogin} disabled={loading}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition disabled:bg-gray-400">
              {loading ? 'Laden...' : (isNewTeam ? 'Registreer nieuw team' : 'Inloggen')}
            </button>
            <button onClick={() => setIsNewTeam(!isNewTeam)} className="w-full text-red-600 hover:underline text-sm">
              {isNewTeam ? 'Al een account? Inloggen' : 'Nieuw team? Registreer hier'}
            </button>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">💡 Data synchroniseert op al je apparaten</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const HomeView = () => {
    const teamMatches = matches.filter(m => m.team_id === currentTeamId);
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-red-600 text-white p-4 shadow-lg">
          <h1 className="text-2xl font-bold">{currentTeam}</h1>
          <button onClick={() => { setCurrentTeam(null); setCurrentTeamId(null); setView('login'); }}
            className="mt-2 text-sm hover:underline">Uitloggen</button>
        </div>
        <div className="max-w-4xl mx-auto p-4 space-y-3">
          <button onClick={() => setView('setup-match')}
            className="w-full bg-white p-4 rounded-lg shadow-lg hover:shadow-xl transition flex items-center group">
            <div className="bg-red-600 p-3 rounded-full group-hover:bg-red-700 transition">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4 text-left">
              <h2 className="text-xl font-bold text-gray-800">Nieuwe wedstrijd</h2>
              <p className="text-sm text-gray-600">Start een nieuwe wedstrijd</p>
            </div>
          </button>
          <button onClick={() => setView('manage-players')}
            className="w-full bg-white p-4 rounded-lg shadow-lg hover:shadow-xl transition flex items-center group">
            <div className="bg-red-600 p-3 rounded-full group-hover:bg-red-700 transition">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4 text-left">
              <h2 className="text-xl font-bold text-gray-800">Spelers beheren</h2>
              <p className="text-sm text-gray-600">Voeg spelers toe of bewerk ze</p>
            </div>
          </button>
          <button onClick={() => setView('statistics')}
            className="w-full bg-white p-4 rounded-lg shadow-lg hover:shadow-xl transition flex items-center group">
            <div className="bg-red-600 p-3 rounded-full group-hover:bg-red-700 transition">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4 text-left">
              <h2 className="text-xl font-bold text-gray-800">Statistieken</h2>
              <p className="text-sm text-gray-600">{teamMatches.length} wedstrijden gespeeld</p>
            </div>
          </button>
        </div>
      </div>
    );
  };

  const ManagePlayersView = () => {
    const currentTeamData = teams.find(t => t.id === currentTeamId);
    const [players, setPlayers] = useState([]);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Sync players state when team data is loaded or when navigating to this view
    // Don't sync while saving to prevent race conditions
    useEffect(() => {
      if (!isSaving) {
        if (currentTeamData) {
          setPlayers(currentTeamData.players || []);
        } else {
          // Team data not loaded yet, reset to empty
          setPlayers([]);
        }
      }
    }, [currentTeamId, currentTeamData, isSaving]);

    const addPlayer = () => {
      if (!newPlayerName.trim()) { showFeedback('Vul een naam in', 'error'); return; }
      if (newPlayerName.trim().length < 2) { showFeedback('Naam moet minimaal 2 tekens zijn', 'error'); return; }
      if (players.find(p => p.name.toLowerCase() === newPlayerName.trim().toLowerCase())) {
        showFeedback('Deze speler bestaat al', 'error'); return;
      }
      const trimmedName = newPlayerName.trim();
      const updated = [...players, { id: Date.now(), name: trimmedName }];
      setPlayers(updated);
      setNewPlayerName('');
      showFeedback(`${trimmedName} toegevoegd`, 'success');
    };

    const removePlayer = (id) => {
      const player = players.find(p => p.id === id);
      setPlayers(players.filter(p => p.id !== id));
      showFeedback(`${player.name} verwijderd`, 'success');
    };

    const savePlayers = async () => {
      setIsSaving(true);
      const success = await saveTeamPlayers(currentTeamId, players);
      setIsSaving(false);
      if (success) {
        showFeedback('Spelers opgeslagen', 'success');
        setView('home');
      }
    };

    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-red-600 text-white p-4 shadow-lg flex items-center">
          <button onClick={() => setView('home')} className="mr-3"><ArrowLeft className="w-6 h-6" /></button>
          <h1 className="text-xl font-bold">Spelers beheren</h1>
        </div>
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
            <div className="flex space-x-2 mb-4">
              <input type="text" placeholder="Naam nieuwe speler" value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:outline-none text-base" />
              <button onClick={addPlayer} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition">
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {players.map(player => (
                <div key={player.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{player.name}</span>
                  <button onClick={() => removePlayer(player.id)} className="text-red-600 hover:text-red-800 font-medium">
                    Verwijder
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button onClick={savePlayers}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition flex items-center justify-center space-x-2">
            <Save className="w-5 h-5" /><span>Opslaan</span>
          </button>
        </div>
      </div>
    );
  };
  const SetupMatchView = () => {
    const currentTeamData = teams.find(t => t.id === currentTeamId);
    const players = currentTeamData?.players || [];
    const [opponent, setOpponent] = useState('');
    const [selectedPlayers, setSelectedPlayers] = useState([]);
    // Default to today's date, formatted for date input (YYYY-MM-DD)
    const [matchDate, setMatchDate] = useState(() => {
      const today = new Date();
      return today.toISOString().split('T')[0];
    });

    // Show message if no players available
    if (players.length === 0) {
      return (
        <div className="min-h-screen bg-gray-100">
          <div className="bg-red-600 text-white p-4 shadow-lg flex items-center">
            <button onClick={() => setView('home')} className="mr-3"><ArrowLeft className="w-6 h-6" /></button>
            <h1 className="text-xl font-bold">Wedstrijd instellen</h1>
          </div>
          <div className="max-w-2xl mx-auto p-4">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <p className="text-gray-600 mb-4">Je hebt nog geen spelers toegevoegd.</p>
              <button onClick={() => setView('manage-players')}
                className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition">
                Spelers toevoegen
              </button>
            </div>
          </div>
        </div>
      );
    }

    const togglePlayer = (player) => {
      if (selectedPlayers.find(p => p.id === player.id)) {
        setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id));
      } else if (selectedPlayers.length < 8) {
        setSelectedPlayers([...selectedPlayers, player]);
      }
    };

    const startMatch = () => {
      if (!opponent.trim()) { showFeedback('Vul de tegenstander in', 'error'); return; }
      if (opponent.trim().length < 2) { showFeedback('Tegenstander naam moet minimaal 2 tekens zijn', 'error'); return; }
      if (selectedPlayers.length !== 8) { showFeedback(`Selecteer exact 8 basisspelers (nu: ${selectedPlayers.length})`, 'error'); return; }

      const allPlayers = players.map(p => ({
        ...p,
        isStarter: selectedPlayers.find(sp => sp.id === p.id) ? true : false,
        stats: SHOT_TYPES.reduce((acc, type) => ({ ...acc, [type.id]: { goals: 0, attempts: 0 } }), {})
      }));

      // Convert date to ISO string (set to noon to avoid timezone issues)
      const dateObj = new Date(matchDate + 'T12:00:00');
      const dateISO = dateObj.toISOString();

      setCurrentMatch({
        team: currentTeam, opponent: opponent.trim(), date: dateISO,
        players: allPlayers, score: 0, opponentScore: 0, opponentGoals: []
      });
      setView('match');
      showFeedback('Wedstrijd gestart!', 'success');
    };

    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-red-600 text-white p-4 shadow-lg flex items-center">
          <button onClick={() => setView('home')} className="mr-3"><ArrowLeft className="w-6 h-6" /></button>
          <h1 className="text-xl font-bold">Wedstrijd instellen</h1>
        </div>
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tegenstander</label>
            <input type="text" value={opponent} onChange={(e) => setOpponent(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:outline-none text-base"
              placeholder="Naam tegenstander" />
          </div>
          <div className="bg-white rounded-lg shadow-lg p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Datum wedstrijd</label>
            <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-red-600 focus:outline-none text-base" />
            <p className="text-xs text-gray-500 mt-1">Selecteer de datum waarop de wedstrijd is/was gespeeld</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              Selecteer 8 basisspelers ({selectedPlayers.length}/8)
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {players.map(player => (
                <button key={player.id} onClick={() => togglePlayer(player)}
                  className={`p-3 rounded-lg font-medium transition text-sm ${
                    selectedPlayers.find(p => p.id === player.id)
                      ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}>
                  {player.name}
                </button>
              ))}
            </div>
          </div>
          <button onClick={startMatch} disabled={!opponent || selectedPlayers.length !== 8}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed">
            Start wedstrijd
          </button>
        </div>
      </div>
    );
  };

  const MatchView = () => {
    const [match, setMatch] = useState(currentMatch);
    const [showGoalModal, setShowGoalModal] = useState(null);
    const [showAttemptModal, setShowAttemptModal] = useState(null);
    const [showOpponentModal, setShowOpponentModal] = useState(false);
    const [showOpponentPlayerModal, setShowOpponentPlayerModal] = useState(null);

    // Sync match state when currentMatch changes
    useEffect(() => {
      if (currentMatch) {
        setMatch(currentMatch);
      }
    }, [currentMatch]);

    // Sync changes back to currentMatch
    useEffect(() => {
      if (match) {
        setCurrentMatch(match);
      }
    }, [match]);

    // Guard against null match
    if (!match || !match.players) {
      return <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Geen wedstrijd gevonden</p>
      </div>;
    }

    const addGoal = (playerId, shotType) => {
      setMatch(prevMatch => {
        const updatedPlayers = prevMatch.players.map(p => {
          if (p.id === playerId) {
            return {
              ...p,
              stats: {
                ...p.stats,
                [shotType]: { goals: p.stats[shotType].goals + 1, attempts: p.stats[shotType].attempts + 1 }
              }
            };
          }
          return p;
        });
        const player = prevMatch.players.find(p => p.id === playerId);
        const shotTypeName = SHOT_TYPES.find(t => t.id === shotType)?.label || shotType;
        showFeedback(`⚽ Goal voor ${player?.name || 'Onbekend'} (${shotTypeName})`, 'success');
        return { ...prevMatch, players: updatedPlayers, score: prevMatch.score + 1 };
      });
      setShowGoalModal(null);
    };

    const addAttempt = (playerId, shotType) => {
      setMatch(prevMatch => {
        const updatedPlayers = prevMatch.players.map(p => {
          if (p.id === playerId) {
            return {
              ...p,
              stats: { ...p.stats, [shotType]: { ...p.stats[shotType], attempts: p.stats[shotType].attempts + 1 } }
            };
          }
          return p;
        });
        const player = prevMatch.players.find(p => p.id === playerId);
        showFeedback(`Poging geregistreerd voor ${player?.name || 'Onbekend'}`, 'success');
        return { ...prevMatch, players: updatedPlayers };
      });
      setShowAttemptModal(null);
    };

    const addOpponentGoal = (shotType) => {
      setShowOpponentPlayerModal(shotType);
      setShowOpponentModal(false);
    };

    const addOpponentGoalWithPlayer = (playerId, shotType) => {
      setMatch(prevMatch => {
        const player = prevMatch.players.find(p => p.id === playerId);
        showFeedback(`Tegendoelpunt tegen ${player?.name || 'Onbekend'}`, 'error');
        return {
          ...prevMatch,
          opponentScore: prevMatch.opponentScore + 1,
          opponentGoals: [...(prevMatch.opponentGoals || []), { type: shotType, time: new Date().toISOString(), concededBy: player?.name || 'Onbekend' }]
        };
      });
      setShowOpponentPlayerModal(null);
    };

    const finishMatch = async () => {
      if (!confirm('Wedstrijd beëindigen? Dit kan niet ongedaan gemaakt worden.')) return;
      if (!match) {
        showFeedback('Geen wedstrijd gevonden', 'error');
        return;
      }
      const success = await saveMatch(match);
      if (success) {
        setCurrentMatch(match);
        setView('match-summary');
      }
    };

    const PlayerRow = ({ player }) => {
      const totalGoals = SHOT_TYPES.reduce((sum, type) => sum + player.stats[type.id].goals, 0);
      const totalAttempts = SHOT_TYPES.reduce((sum, type) => sum + player.stats[type.id].attempts, 0);

      return (
        <div className="border-b border-gray-200 py-3 last:border-0">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="font-semibold text-gray-800">{player.name}</span>
              <span className="text-sm text-gray-600 ml-2">{totalGoals}/{totalAttempts} pogingen</span>
            </div>
            <div className="flex space-x-2">
              <button onClick={() => setShowGoalModal(player)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition">
                Goal
              </button>
              <button onClick={() => setShowAttemptModal(player)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
                Poging
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {SHOT_TYPES.map(type => {
              const stat = player.stats[type.id];
              if (stat.attempts === 0) return null;
              return (
                <span key={type.id} className="bg-gray-100 px-2 py-1 rounded">
                  {type.short}: {stat.goals}/{stat.attempts}
                </span>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="min-h-screen bg-gray-100 pb-20">
        <div className="bg-red-600 text-white p-4 shadow-lg sticky top-0 z-10">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-xl font-bold">{match.team}</h1>
            <h1 className="text-xl font-bold">{match.opponent}</h1>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold">{match.score} - {match.opponentScore}</div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4">
          <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
            <h2 className="font-bold text-lg mb-3 text-gray-800">Basisspelers</h2>
            {match.players.filter(p => p.isStarter).map(player => <PlayerRow key={player.id} player={player} />)}
          </div>
          <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
            <h2 className="font-bold text-lg mb-3 text-gray-800">Wisselspelers</h2>
            {match.players.filter(p => !p.isStarter).map(player => <PlayerRow key={player.id} player={player} />)}
          </div>
          <button onClick={() => setShowOpponentModal(true)}
            className="w-full bg-gray-800 text-white py-4 rounded-lg font-semibold hover:bg-gray-900 transition mb-4">
            + Tegendoelpunt
          </button>
          <button onClick={finishMatch}
            className="w-full bg-red-600 text-white py-4 rounded-lg font-semibold hover:bg-red-700 transition">
            Wedstrijd beëindigen
          </button>
        </div>
        {showGoalModal && <ShotTypeModal title="Doelpunt registreren"
          onSelect={(type) => addGoal(showGoalModal.id, type)} onClose={() => setShowGoalModal(null)} />}
        {showAttemptModal && <ShotTypeModal title="Schotpoging registreren"
          onSelect={(type) => addAttempt(showAttemptModal.id, type)} onClose={() => setShowAttemptModal(null)} />}
        {showOpponentModal && <ShotTypeModal title="Tegendoelpunt type"
          onSelect={addOpponentGoal} onClose={() => setShowOpponentModal(false)} />}
        {showOpponentPlayerModal && <PlayerSelectModal title="Wie kreeg doelpunt tegen?" players={match.players}
          onSelect={(playerId) => addOpponentGoalWithPlayer(playerId, showOpponentPlayerModal)}
          onClose={() => setShowOpponentPlayerModal(null)} />}
      </div>
    );
  };

  const ShotTypeModal = ({ title, onSelect, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 max-w-sm w-full">
        <h2 className="text-lg font-bold mb-3 text-gray-800">{title}</h2>
        <div className="grid grid-cols-2 gap-2">
          {SHOT_TYPES.map(type => (
            <button key={type.id} onClick={() => onSelect(type.id)}
              className="bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 transition font-semibold text-sm">
              {type.label}
            </button>
          ))}
        </div>
        <button onClick={onClose}
          className="w-full mt-3 bg-gray-300 text-gray-800 py-2 rounded-lg hover:bg-gray-400 transition font-medium">
          Annuleren
        </button>
      </div>
    </div>
  );

  const PlayerSelectModal = ({ title, players, onSelect, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 max-w-sm w-full max-h-96 overflow-y-auto">
        <h2 className="text-lg font-bold mb-3 text-gray-800">{title}</h2>
        <div className="space-y-2">
          {players.map(player => (
            <button key={player.id} onClick={() => onSelect(player.id)}
              className="w-full bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 transition font-semibold text-left text-sm">
              {player.name}
            </button>
          ))}
        </div>
        <button onClick={onClose}
          className="w-full mt-3 bg-gray-300 text-gray-800 py-2 rounded-lg hover:bg-gray-400 transition font-medium">
          Annuleren
        </button>
      </div>
    </div>
  );
  const MatchSummaryView = () => {
    const match = currentMatch;
    
    if (!match || !match.players) {
      return <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Geen wedstrijd gevonden</p>
      </div>;
    }
    
    const scoreTimeline = [];
    
    match.players.forEach(player => {
      SHOT_TYPES.forEach(type => {
        const goals = player.stats[type.id].goals;
        for (let i = 0; i < goals; i++) {
          scoreTimeline.push({ team: match.team, player: player.name, type: type.label, isOwn: true });
        }
      });
    });

    (match.opponentGoals || []).forEach(goal => {
      const shotType = SHOT_TYPES.find(t => t.id === goal.type);
      scoreTimeline.push({ team: match.opponent, player: goal.concededBy, type: shotType?.label || 'Onbekend', isOwn: false });
    });

    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-red-600 text-white p-6 shadow-lg">
          <h1 className="text-2xl font-bold mb-2">Wedstrijd afgelopen</h1>
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">{match.score} - {match.opponentScore}</div>
            <div className="text-xl">{match.team} vs {match.opponent}</div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Scoreverloop</h2>
            <div className="space-y-2">
              {scoreTimeline.map((goal, idx) => {
                const currentScore = scoreTimeline.slice(0, idx + 1).filter(g => g.isOwn).length;
                const currentOpponentScore = scoreTimeline.slice(0, idx + 1).filter(g => !g.isOwn).length;
                return (
                  <div key={idx} className={`p-3 rounded-lg ${goal.isOwn ? 'bg-green-50 border-l-4 border-green-600' : 'bg-red-50 border-l-4 border-red-600'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold">{goal.isOwn ? '⚽' : '🚫'} {goal.team}</span>
                        <span className="text-sm text-gray-600 ml-2">
                          {goal.isOwn ? `${goal.player} - ${goal.type}` : `Tegen ${goal.player} - ${goal.type}`}
                        </span>
                      </div>
                      <div className="font-bold text-lg">{currentScore} - {currentOpponentScore}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Speler statistieken</h2>
            {match.players.sort((a, b) => {
              const aGoals = SHOT_TYPES.reduce((sum, type) => sum + a.stats[type.id].goals, 0);
              const bGoals = SHOT_TYPES.reduce((sum, type) => sum + b.stats[type.id].goals, 0);
              return bGoals - aGoals;
            }).map(player => {
              const totalGoals = SHOT_TYPES.reduce((sum, type) => sum + player.stats[type.id].goals, 0);
              const totalAttempts = SHOT_TYPES.reduce((sum, type) => sum + player.stats[type.id].attempts, 0);
              const percentage = totalAttempts > 0 ? Math.round((totalGoals / totalAttempts) * 100) : 0;
              return (
                <div key={player.id} className="border-b border-gray-200 py-4 last:border-0">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-lg">{player.name}</span>
                    <span className="text-gray-600">{totalGoals} doelpunten / {totalAttempts} pogingen ({percentage}%)</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {SHOT_TYPES.map(type => {
                      const stat = player.stats[type.id];
                      if (stat.attempts === 0) return null;
                      return (
                        <span key={type.id} className="bg-gray-100 px-3 py-1 rounded">
                          {type.label}: {stat.goals}/{stat.attempts}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Tegendoelpunten overzicht</h2>
            {(match.opponentGoals || []).length > 0 ? (
              <div className="space-y-2">
                {(match.opponentGoals || []).map((goal, idx) => {
                  const shotType = SHOT_TYPES.find(t => t.id === goal.type);
                  return (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                      <span className="font-medium">{goal.concededBy}</span>
                      <span className="text-sm text-gray-600">{shotType?.label || 'Onbekend'}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-gray-600">Geen tegendoelpunten</p>}
          </div>
          <button onClick={() => { setCurrentMatch(null); setView('home'); }}
            className="w-full bg-red-600 text-white py-4 rounded-lg font-semibold hover:bg-red-700 transition">
            Terug naar home
          </button>
        </div>
      </div>
    );
  };

  const StatisticsView = () => {
    const teamMatches = matches.filter(m => m.team_id === currentTeamId);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const playerStats = {};

    teamMatches.forEach(match => {
      if (!match.players || !Array.isArray(match.players)) return;
      match.players.forEach(player => {
        if (!player || !player.name) return;
        if (!playerStats[player.name]) {
          playerStats[player.name] = {
            matches: 0, goals: 0, attempts: 0,
            byType: SHOT_TYPES.reduce((acc, type) => ({ ...acc, [type.id]: { goals: 0, attempts: 0 } }), {})
          };
        }
        playerStats[player.name].matches++;
        SHOT_TYPES.forEach(type => {
          const stats = player.stats?.[type.id] || { goals: 0, attempts: 0 };
          playerStats[player.name].goals += stats.goals || 0;
          playerStats[player.name].attempts += stats.attempts || 0;
          playerStats[player.name].byType[type.id].goals += stats.goals || 0;
          playerStats[player.name].byType[type.id].attempts += stats.attempts || 0;
        });
      });
    });

    const totalGoals = teamMatches.reduce((sum, m) => sum + m.score, 0);
    const totalAgainst = teamMatches.reduce((sum, m) => sum + m.opponent_score, 0);
    const wins = teamMatches.filter(m => m.score > m.opponent_score).length;
    const losses = teamMatches.filter(m => m.score < m.opponent_score).length;
    const draws = teamMatches.filter(m => m.score === m.opponent_score).length;

    const handleDeleteMatch = async (match) => {
      if (confirm('Weet je zeker dat je deze wedstrijd wilt verwijderen?')) {
        await deleteMatch(match.id);
        if (selectedMatch && selectedMatch.id === match.id) setSelectedMatch(null);
      }
    };

    if (selectedMatch) {
      return <MatchDetailView match={selectedMatch} onBack={() => setSelectedMatch(null)} 
        onDelete={() => handleDeleteMatch(selectedMatch)} />;
    }

    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-red-600 text-white p-6 shadow-lg flex items-center">
          <button onClick={() => setView('home')} className="mr-4"><ArrowLeft className="w-6 h-6" /></button>
          <h1 className="text-2xl font-bold">Statistieken</h1>
        </div>
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Team overzicht</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{teamMatches.length}</div>
                <div className="text-gray-600">Wedstrijden</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{wins}</div>
                <div className="text-gray-600">Gewonnen</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">{draws}</div>
                <div className="text-gray-600">Gelijk</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-800">{losses}</div>
                <div className="text-gray-600">Verloren</div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{totalGoals}</div>
                <div className="text-gray-600">Doelpunten voor</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">{totalAgainst}</div>
                <div className="text-gray-600">Doelpunten tegen</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Speler statistieken</h2>
            <div className="space-y-4">
              {Object.entries(playerStats).sort(([, a], [, b]) => b.goals - a.goals).map(([name, stats]) => {
                const percentage = stats.attempts > 0 ? Math.round((stats.goals / stats.attempts) * 100) : 0;
                return (
                  <div key={name} className="border-b border-gray-200 pb-4 last:border-0">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-lg">{name}</span>
                      <span className="text-gray-600">{stats.goals} doelpunten / {stats.attempts} pogingen ({percentage}%)</span>
                    </div>
                    <div className="text-sm text-gray-500 mb-2">{stats.matches} wedstrijden gespeeld</div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      {SHOT_TYPES.map(type => {
                        const typeStat = stats.byType[type.id];
                        if (typeStat.attempts === 0) return null;
                        const typePercentage = Math.round((typeStat.goals / typeStat.attempts) * 100);
                        return (
                          <span key={type.id} className="bg-gray-100 px-3 py-1 rounded">
                            {type.label}: {typeStat.goals}/{typeStat.attempts} ({typePercentage}%)
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Wedstrijd geschiedenis</h2>
            <div className="space-y-3">
              {teamMatches.sort((a, b) => new Date(b.date) - new Date(a.date)).map((match) => (
                <div key={match.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start gap-3">
                    <button onClick={() => setSelectedMatch(match)} className="flex-1 text-left">
                      <div className="font-semibold">{match.team_name} vs {match.opponent}</div>
                      <div className="text-sm text-gray-600">{new Date(match.date).toLocaleDateString('nl-NL')}</div>
                    </button>
                    <div className="flex items-center gap-3">
                      <div className={`text-xl font-bold whitespace-nowrap ${
                        match.score > match.opponent_score ? 'text-green-600' :
                        match.score < match.opponent_score ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {match.score} - {match.opponent_score}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteMatch(match); }}
                        className="text-red-600 hover:text-red-800 text-sm font-medium">✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MatchDetailView = ({ match, onBack, onDelete }) => {
    if (!match || !match.players) {
      return <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Geen wedstrijd gevonden</p>
      </div>;
    }
    
    const scoreTimeline = [];
    match.players.forEach(player => {
      SHOT_TYPES.forEach(type => {
        const goals = player.stats?.[type.id]?.goals || 0;
        for (let i = 0; i < goals; i++) {
          scoreTimeline.push({ team: match.team_name, player: player.name, type: type.label, isOwn: true });
        }
      });
    });
    (match.opponent_goals || []).forEach(goal => {
      const shotType = SHOT_TYPES.find(t => t.id === goal.type);
      scoreTimeline.push({ team: match.opponent, player: goal.concededBy, type: shotType?.label || 'Onbekend', isOwn: false });
    });

    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-red-600 text-white p-4 shadow-lg sticky top-0 z-10">
          <button onClick={onBack} className="mb-2 flex items-center text-white">
            <ArrowLeft className="w-5 h-5 mr-2" /><span>Terug</span>
          </button>
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">{match.score} - {match.opponent_score}</div>
            <div className="text-lg">{match.team_name} vs {match.opponent}</div>
            <div className="text-sm opacity-90">
              {new Date(match.date).toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-lg font-bold mb-3 text-gray-800">Scoreverloop</h2>
            <div className="space-y-2">
              {scoreTimeline.map((goal, idx) => {
                const currentScore = scoreTimeline.slice(0, idx + 1).filter(g => g.isOwn).length;
                const currentOpponentScore = scoreTimeline.slice(0, idx + 1).filter(g => !g.isOwn).length;
                return (
                  <div key={idx} className={`p-3 rounded-lg ${goal.isOwn ? 'bg-green-50 border-l-4 border-green-600' : 'bg-red-50 border-l-4 border-red-600'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{goal.isOwn ? '⚽' : '🚫'} {goal.team}</div>
                        <div className="text-xs text-gray-600 truncate">
                          {goal.isOwn ? `${goal.player} - ${goal.type}` : `Tegen ${goal.player} - ${goal.type}`}
                        </div>
                      </div>
                      <div className="font-bold text-base whitespace-nowrap">{currentScore} - {currentOpponentScore}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <button onClick={onDelete}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition">
            Wedstrijd verwijderen
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {feedback && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg max-w-sm w-full mx-4 ${
          feedback.type === 'success' ? 'bg-green-600 text-white' : 
          feedback.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
        }`}>
          <p className="font-medium text-center text-sm">{feedback.message}</p>
        </div>
      )}
      {view === 'login' && <LoginView />}
      {view === 'home' && <HomeView />}
      {view === 'manage-players' && <ManagePlayersView />}
      {view === 'setup-match' && <SetupMatchView />}
      {view === 'match' && <MatchView />}
      {view === 'match-summary' && <MatchSummaryView />}
      {view === 'statistics' && <StatisticsView />}
    </div>
  );
}
