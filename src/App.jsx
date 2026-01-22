// Complete App.jsx code for Korfbal Score and Statistics App
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';

import LoginView from './views/LoginView';
import HomeView from './views/HomeView';
import ManagePlayersView from './views/ManagePlayersView';
import SetupMatchView from './views/SetupMatchView';
import MatchView from './views/MatchView';
import MatchSummaryView from './views/MatchSummaryView';
import StatisticsView from './views/StatisticsView';

function App() {
  return (
    <Router>
      <Switch>
        <Route path='/' exact component={LoginView} />
        <Route path='/home' component={HomeView} />
        <Route path='/manage-players' component={ManagePlayersView} />
        <Route path='/setup-match' component={SetupMatchView} />
        <Route path='/match' component={MatchView} />
        <Route path='/match-summary' component={MatchSummaryView} />
        <Route path='/statistics' component={StatisticsView} />
      </Switch>
    </Router>
  );
}

export default App;

// ManagePlayersView.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function ManagePlayersView() {
  const [players, setPlayers] = useState([]);
  const [newPlayerName, setNewPlayerName] = useState('');

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from('players')
      .select('*');
    setPlayers(data);
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName) return;
    const { error } = await supabase
      .from('players')
      .insert([{ name: newPlayerName }]);
    if (!error) {
      setNewPlayerName('');
      fetchPlayers();
    }
  };

  return (
    <div>
      <h1>Manage Players</h1>
      <ul>
        {players.map((player) => (
          <li key={player.id}>{player.name}</li>
        ))}
      </ul>
      <input
        value={newPlayerName}
        onChange={(e) => setNewPlayerName(e.target.value)}
        placeholder='New Player Name'
      />
      <button onClick={handleAddPlayer}>Add Player</button>
    </div>
  );
}

export default ManagePlayersView;
