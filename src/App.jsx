import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Trophy, Users, BarChart3, Plus, ArrowLeft, Download, Home, Search, Moon, Sun } from 'lucide-react';
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

// Error boundary to catch rendering crashes - exported for use in main.jsx
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('App crash:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Er ging iets mis</h1>
            <p className="text-gray-600 mb-6">De app is onverwacht gestopt. Probeer de pagina te herladen.</p>
            <button onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 active:scale-95 transition-all">
              Pagina herladen
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const SHOT_TYPES = [
  { id: 'distance', label: 'Afstandschot', short: 'AS' },
  { id: 'close', label: 'Kans bij korf', short: 'KK' },
  { id: 'penalty', label: 'Strafworp', short: 'SW' },
  { id: 'freeball', label: 'Vrije bal', short: 'VB' },
  { id: 'runthrough', label: 'Doorloopbal', short: 'DL' },
  { id: 'outstart', label: 'Uitstart', short: 'US' },
  { id: 'other', label: 'Overig', short: 'OV' }
];

// Custom hook for debouncing values
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Player ID generator to prevent collisions
let playerIdCounter = 0;
const generatePlayerId = () => `player_${Date.now()}_${++playerIdCounter}`;

// Reusable confirm dialog component (replaces browser confirm())
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Bevestigen', cancelLabel = 'Annuleren', variant = 'danger' }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll('button');
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    setTimeout(() => modalRef.current?.querySelector('[data-cancel]')?.focus(), 50);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-[60] p-4"
      role="dialog" aria-modal="true" aria-label={title} ref={modalRef}>
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h2 className="text-lg font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} data-cancel
            className="flex-1 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className={`flex-1 py-3 rounded-lg font-semibold text-white active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-offset-2 ${
              variant === 'danger' ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500' : 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-500'
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// Reusable input dialog component (for text input prompts)
const InputDialog = ({ isOpen, title, message, placeholder, onSubmit, onCancel, submitLabel = 'Opslaan', inputType = 'text' }) => {
  const [value, setValue] = useState('');
  const modalRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && value.trim()) onSubmit(value.trim());
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onSubmit, value]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-[60] p-4"
      role="dialog" aria-modal="true" aria-label={title} ref={modalRef}>
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">{title}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
        <input
          ref={inputRef}
          type={inputType}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg mb-4 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
        />
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all">
            Annuleren
          </button>
          <button onClick={() => value.trim() && onSubmit(value.trim())} disabled={!value.trim()}
            className="flex-1 py-3 rounded-lg font-semibold text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 active:scale-95 transition-all">
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function KorfbalApp() {
  const [view, setView] = useState('login');
  const [currentTeam, setCurrentTeam] = useState(null);
  const [currentTeamId, setCurrentTeamId] = useState(null);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showGodMode, setShowGodMode] = useState(false);
  const [sharedMatchId, setSharedMatchId] = useState(null);
  const [pendingSavedMatch, setPendingSavedMatch] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'danger' });
  const [inputDialog, setInputDialog] = useState({ isOpen: false, title: '', message: '', placeholder: '', onSubmit: null, inputType: 'text' });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('korfbal_dark_mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const feedbackTimersRef = useRef({ fade: null, remove: null });

  // Apply dark mode class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('korfbal_dark_mode', darkMode);
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => setDarkMode(prev => !prev), []);

  const showConfirm = useCallback(({ title, message, onConfirm, variant = 'danger', confirmLabel, cancelLabel }) => {
    setConfirmDialog({
      isOpen: true, title, message, variant,
      confirmLabel: confirmLabel || 'Bevestigen',
      cancelLabel: cancelLabel || 'Annuleren',
      onConfirm: () => { setConfirmDialog(prev => ({ ...prev, isOpen: false })); onConfirm(); }
    });
  }, []);

  const showInput = useCallback(({ title, message, placeholder, onSubmit, inputType = 'text' }) => {
    setInputDialog({
      isOpen: true, title, message, placeholder, inputType,
      onSubmit: (val) => { setInputDialog(prev => ({ ...prev, isOpen: false })); onSubmit(val); }
    });
  }, []);

  // Enhanced navigation function with browser history support
  const navigateTo = useCallback((newView) => {
    setView(newView);
    window.history.pushState({ view: newView }, '', `#${newView}`);
  }, []);

  // Convex queries - only load god-mode data when needed
  const allTeams = useQuery(api.teams.getAllTeams, showGodMode ? {} : "skip");
  const teams = showGodMode ? (allTeams || []) : [];

  const teamMatches = useQuery(
    api.matches.getTeamMatches,
    currentTeamId && !showGodMode ? { teamId: currentTeamId } : "skip"
  );
  const allMatches = useQuery(api.matches.getAllMatches, showGodMode ? {} : "skip");
  const matches = showGodMode ? (allMatches || []) : (teamMatches || []);

  // Shared match query
  const sharedMatchData = useQuery(
    api.matches.getShareableMatch,
    sharedMatchId ? { matchId: sharedMatchId } : "skip"
  );

  // Current team query - for getting players
  const currentTeamData = useQuery(
    api.teams.getTeam,
    currentTeamId && !showGodMode ? { teamId: currentTeamId } : "skip"
  );

  // Debounce currentMatch to reduce localStorage writes
  const debouncedMatch = useDebounce(currentMatch, 500);

  useEffect(() => {
    // Clear bestaande timers EERST om overlapping te voorkomen
    if (feedbackTimersRef.current.fade) {
      clearTimeout(feedbackTimersRef.current.fade);
      feedbackTimersRef.current.fade = null;
    }
    if (feedbackTimersRef.current.remove) {
      clearTimeout(feedbackTimersRef.current.remove);
      feedbackTimersRef.current.remove = null;
    }

    if (feedback && feedback.visible !== false) {
      // Fade timer
      feedbackTimersRef.current.fade = setTimeout(() => {
        setFeedback(prev => {
          // Verify we're updating the SAME feedback
          if (prev && prev.message === feedback.message && prev.type === feedback.type) {
            return { ...prev, visible: false };
          }
          return prev;
        });
      }, 2700);

      // Remove timer
      feedbackTimersRef.current.remove = setTimeout(() => {
        setFeedback(prev => {
          // Only remove if still the same feedback
          if (prev && prev.message === feedback.message && prev.type === feedback.type) {
            return null;
          }
          return prev;
        });
      }, 3000);
    }

    // Cleanup on unmount
    return () => {
      if (feedbackTimersRef.current.fade) {
        clearTimeout(feedbackTimersRef.current.fade);
      }
      if (feedbackTimersRef.current.remove) {
        clearTimeout(feedbackTimersRef.current.remove);
      }
    };
  }, [feedback]);

  // Views that require authentication
  const authRequiredViews = ['home', 'manage-players', 'setup-match', 'match', 'match-summary', 'statistics'];

  // Browser history navigation support (back/forward buttons)
  useEffect(() => {
    const handlePopState = (event) => {
      const targetView = event.state?.view || window.location.hash.substring(1);
      if (targetView) {
        // Prevent navigating to auth-required views without being logged in
        if (authRequiredViews.includes(targetView) && !currentTeamId) {
          setView('login');
          window.history.replaceState({ view: 'login' }, '', '#login');
        } else {
          setView(targetView);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    // Set initial state
    const initialHash = window.location.hash.substring(1);
    if (initialHash && !authRequiredViews.includes(initialHash)) {
      setView(initialHash);
    } else if (!initialHash) {
      window.history.replaceState({ view: 'login' }, '', '#login');
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentTeamId]);

  // Note: God Mode data loading now handled by Convex queries automatically
  // Teams and matches load reactively based on showGodMode state

  // Auto-save currentMatch to localStorage (debounced)
  useEffect(() => {
    if (debouncedMatch && currentTeamId) {
      const matchData = {
        match: debouncedMatch,
        teamId: currentTeamId,
        teamName: currentTeam,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('korfbal_active_match', JSON.stringify(matchData));
    }
  }, [debouncedMatch, currentTeamId, currentTeam]);

  // Session recovery - restore match from localStorage on mount
  useEffect(() => {
    const savedMatchData = localStorage.getItem('korfbal_active_match');
    if (savedMatchData) {
      try {
        const parsed = JSON.parse(savedMatchData);
        // Only restore if we have a team loaded and it matches
        if (parsed.teamId && parsed.match) {
          // Use React state instead of global
          setPendingSavedMatch(parsed);
        }
      } catch (e) {
        console.error('Error parsing saved match:', e);
        localStorage.removeItem('korfbal_active_match');
      }
    }
  }, []);

  // Check for saved match after team is loaded
  useEffect(() => {
    if (currentTeamId && pendingSavedMatch) {
      const saved = pendingSavedMatch;
      if (saved.teamId === currentTeamId) {
        const timeDiff = new Date() - new Date(saved.timestamp);
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // Only restore if less than 24 hours old
        if (hoursDiff < 24) {
          setCurrentMatch(saved.match);
          navigateTo('match');
          showFeedback('Wedstrijd hersteld! Je kunt verder waar je was gebleven.', 'success');
        } else {
          localStorage.removeItem('korfbal_active_match');
        }
      }
      setPendingSavedMatch(null); // Clear state
    }
  }, [currentTeamId, pendingSavedMatch]);

  // Session persistence - restore login on mount
  useEffect(() => {
    // Check for shared match in URL first
    const urlParams = new URLSearchParams(window.location.search);
    const matchId = urlParams.get('match');

    if (matchId) {
      setSharedMatchId(matchId);
      return; // Don't restore session if loading shared match
    }

    // Normal session restore
    const savedSession = localStorage.getItem('korfbal_session');
    if (savedSession) {
      try {
        const { teamName, teamId } = JSON.parse(savedSession);

        // Check if this is an old Supabase UUID (format: 8-4-4-4-12 with dashes)
        const isOldUUID = teamId && teamId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        if (isOldUUID) {
          localStorage.removeItem('korfbal_session');
          localStorage.removeItem('korfbal_active_match');
          showFeedback('Sessie verlopen, log opnieuw in na de migratie naar Convex', 'info');
          return;
        }

        setCurrentTeam(teamName);
        setCurrentTeamId(teamId);
        navigateTo('home');
      } catch (e) {
        console.error('Error restoring session:', e);
        localStorage.removeItem('korfbal_session');
      }
    }
  }, []);

  // Handle shared match data once loaded
  useEffect(() => {
    if (sharedMatchData) {
      setCurrentMatch(sharedMatchData);
      navigateTo('shared-match');
    }
  }, [sharedMatchData]);

  const showFeedback = useCallback((message, type = 'error') => {
    setFeedback({ message, type, visible: true });
  }, []);

  // Convex mutations
  const loginMutation = useMutation(api.auth.login);
  const registerMutation = useMutation(api.auth.register);
  const updatePlayersMutation = useMutation(api.teams.updatePlayers);
  const deleteTeamMutation = useMutation(api.teams.deleteTeam);
  const resetPasswordMutation = useMutation(api.teams.resetPassword);
  const renameTeamMutation = useMutation(api.teams.renameTeam);
  const mergeTeamsMutation = useMutation(api.teams.mergeTeams);
  const createMatchMutation = useMutation(api.matches.createMatch);
  const updateMatchMutation = useMutation(api.matches.updateMatch);
  const deleteMatchMutation = useMutation(api.matches.deleteMatch);

  const saveTeamPlayers = async (teamId, players) => {
    try {
      // Sanitize players: only send id and name to match Convex validator
      const sanitized = players.map(p => ({ id: p.id, name: p.name }));
      await updatePlayersMutation({ teamId, players: sanitized });
      return true;
    } catch (e) {
      console.error('Error saving players:', e);
      showFeedback('Fout bij opslaan spelers', 'error');
      return false;
    }
  };

  const saveMatch = async (match) => {
    try {
      const matchId = await createMatchMutation({
        teamId: currentTeamId,
        teamName: currentTeam,
        opponent: match.opponent,
        date: match.date,
        players: match.players,
        score: match.score,
        opponentScore: match.opponentScore,
        opponentGoals: match.opponentGoals || [],
        goals: match.goals || [],
        finished: true,
        shareable: false,
      });
      // Update currentMatch with database ID to prevent duplicate creation
      setCurrentMatch(prev => prev ? { ...prev, _id: matchId } : prev);
      // Clear localStorage after successful save
      localStorage.removeItem('korfbal_active_match');
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
      await deleteMatchMutation({ matchId });
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

    const handleLogin = async () => {
      if (!teamName || !password) {
        showFeedback('Vul beide velden in', 'error');
        return;
      }
      setLoading(true);
      try {
        const result = await loginMutation({
          team_name: teamName,
          password: password,
        });

        if (result.isGodMode) {
          setShowGodMode(true);
          navigateTo('god-mode');
        } else {
          setCurrentTeam(result.teamName);
          setCurrentTeamId(result.teamId);
          // Save session to localStorage
          localStorage.setItem('korfbal_session', JSON.stringify({
            teamName: result.teamName,
            teamId: result.teamId
          }));
          navigateTo('home');
          showFeedback(`Welkom ${result.teamName}!`, 'success');
        }
      } catch (e) {
        showFeedback(e.message || 'Fout bij inloggen', 'error');
      }
      setLoading(false);
    };

    const handleRegister = async () => {
      if (!teamName || !password) {
        showFeedback('Vul beide velden in', 'error');
        return;
      }
      setLoading(true);
      try {
        const result = await registerMutation({
          team_name: teamName,
          password: password,
        });

        setCurrentTeam(result.teamName);
        setCurrentTeamId(result.teamId);
        // Save session to localStorage
        localStorage.setItem('korfbal_session', JSON.stringify({
          teamName: result.teamName,
          teamId: result.teamId
        }));
        navigateTo('home');
        showFeedback(`Team "${result.teamName}" succesvol aangemaakt!`, 'success');
      } catch (e) {
        showFeedback(e.message || 'Fout bij registreren', 'error');
      }
      setLoading(false);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <Trophy className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Korfbal Score App</h1>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="login-teamname" className="block text-sm font-medium text-gray-700 mb-1">Teamnaam</label>
              <input id="login-teamname" type="text" placeholder="Vul je teamnaam in" value={teamName} onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-red-600 focus:outline-none dark:bg-gray-700 dark:text-gray-100 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2" />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">Wachtwoord</label>
              <input id="login-password" type="password" placeholder="Vul je wachtwoord in" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (isNewTeam ? handleRegister() : handleLogin())}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-red-600 focus:outline-none dark:bg-gray-700 dark:text-gray-100 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2" />
            </div>
            <button onClick={isNewTeam ? handleRegister : handleLogin} disabled={loading}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 active:scale-95 transition-all disabled:bg-gray-400 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
              {loading ? 'Laden...' : (isNewTeam ? 'Registreer nieuw team' : 'Inloggen')}
            </button>
            <button onClick={() => setIsNewTeam(!isNewTeam)} className="w-full text-red-600 hover:underline text-sm">
              {isNewTeam ? 'Al een account? Inloggen' : 'Nieuw team? Registreer hier'}
            </button>
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <p className="text-xs text-gray-500 text-center">💡 Data synchroniseert op al je apparaten</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('korfbal_session');
    localStorage.removeItem('korfbal_active_match');
    setCurrentTeam(null);
    setCurrentTeamId(null);
    setCurrentMatch(null);
    navigateTo('login');
    showFeedback('Uitgelogd', 'success');
  }, [navigateTo, showFeedback]);

  const GodModeView = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedTeamId, setExpandedTeamId] = useState(null);
    const [showPasswords, setShowPasswords] = useState(new Set());

    // Detect duplicate teams (same team_name)
    const duplicateGroups = useMemo(() => {
      if (!teams.length) return {};
      const groups = {};
      teams.forEach(team => {
        const key = team.team_name.toLowerCase();
        if (!groups[key]) groups[key] = [];
        groups[key].push(team);
      });
      return Object.fromEntries(
        Object.entries(groups).filter(([, arr]) => arr.length > 1)
      );
    }, [teams]);

    const duplicateTeamIds = useMemo(() => {
      const ids = new Set();
      Object.values(duplicateGroups).forEach(group => {
        group.forEach(t => ids.add(t._id));
      });
      return ids;
    }, [duplicateGroups]);

    // Suggest which team to keep (most matches > most players > oldest)
    const suggestTarget = (group) => {
      return [...group].sort((a, b) => {
        const aMatches = matches.filter(m => m.team_id === a._id).length;
        const bMatches = matches.filter(m => m.team_id === b._id).length;
        if (bMatches !== aMatches) return bMatches - aMatches;
        const aPlayers = a.players?.length || 0;
        const bPlayers = b.players?.length || 0;
        if (bPlayers !== aPlayers) return bPlayers - aPlayers;
        return (a._creationTime || 0) - (b._creationTime || 0);
      })[0];
    };

    // Filter teams by search
    const filteredTeams = useMemo(() => {
      if (!searchQuery.trim()) return teams;
      const q = searchQuery.toLowerCase();
      return teams.filter(t => t.team_name.toLowerCase().includes(q));
    }, [teams, searchQuery]);

    const handleRename = (team) => {
      showInput({
        title: 'Team hernoemen',
        message: `Nieuwe naam voor "${team.team_name}":`,
        placeholder: team.team_name,
        onSubmit: async (newName) => {
          try {
            await renameTeamMutation({ teamId: team._id, newName: newName.trim() });
            showFeedback(`Team hernoemd naar "${newName.trim()}"`, 'success');
          } catch (e) {
            showFeedback(e.message || 'Fout bij hernoemen', 'error');
          }
        }
      });
    };

    const handleResetPassword = (team) => {
      showInput({
        title: 'Wachtwoord wijzigen',
        message: `Nieuw wachtwoord voor "${team.team_name}":`,
        placeholder: 'Nieuw wachtwoord (min. 3 tekens)',
        onSubmit: async (newPassword) => {
          try {
            await resetPasswordMutation({ teamId: team._id, newPassword });
            showFeedback('Wachtwoord gewijzigd', 'success');
          } catch (e) {
            showFeedback(e.message || 'Fout bij wijzigen wachtwoord', 'error');
          }
        }
      });
    };

    const handleMerge = (targetTeam, sourceTeam) => {
      const targetMatchCount = matches.filter(m => m.team_id === targetTeam._id).length;
      const sourceMatchCount = matches.filter(m => m.team_id === sourceTeam._id).length;
      showConfirm({
        title: 'Teams samenvoegen',
        message: `"${sourceTeam.team_name}" (${sourceMatchCount} wedstrijden, ${sourceTeam.players?.length || 0} spelers) samenvoegen met "${targetTeam.team_name}" (${targetMatchCount} wedstrijden, ${targetTeam.players?.length || 0} spelers)?\n\nHet duplicaat wordt verwijderd.`,
        confirmLabel: 'Samenvoegen',
        onConfirm: async () => {
          try {
            const result = await mergeTeamsMutation({
              targetTeamId: targetTeam._id,
              sourceTeamId: sourceTeam._id,
            });
            showFeedback(`Samengevoegd: ${result.matchesMoved} wedstrijden verplaatst, ${result.playersMerged} spelers toegevoegd`, 'success');
          } catch (e) {
            showFeedback(e.message || 'Fout bij samenvoegen', 'error');
          }
        }
      });
    };

    const handleDelete = (team) => {
      const teamMatchCount = matches.filter(m => m.team_id === team._id).length;
      showConfirm({
        title: 'Team verwijderen',
        message: `Team "${team.team_name}" verwijderen? Dit verwijdert ook ${teamMatchCount} wedstrijd(en).`,
        onConfirm: async () => {
          try {
            await deleteTeamMutation({ teamId: team._id });
            showFeedback('Team en wedstrijden verwijderd', 'success');
          } catch (e) {
            showFeedback('Fout bij verwijderen', 'error');
          }
        }
      });
    };

    const togglePassword = (teamId) => {
      setShowPasswords(prev => {
        const next = new Set(prev);
        if (next.has(teamId)) next.delete(teamId);
        else next.add(teamId);
        return next;
      });
    };

    const dupCount = Object.keys(duplicateGroups).length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-600 to-yellow-800 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">God Mode</h1>
            <button onClick={() => {
              setShowGodMode(false);
              navigateTo('login');
            }} className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 px-3 py-1" aria-label="God mode sluiten">Sluiten</button>
          </div>

          {!teams ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">Laden...</p>
            </div>
          ) : (
            <>
              {/* Stats summary */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">{teams.length}</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">Teams</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">{matches.length}</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">Wedstrijden</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${dupCount > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-green-50 dark:bg-green-900/30'}`}>
                  <p className={`text-2xl font-bold ${dupCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{dupCount}</p>
                  <p className={`text-xs ${dupCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>Duplicaten</p>
                </div>
              </div>

              {/* Duplicate alert */}
              {dupCount > 0 && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded">
                  <p className="font-semibold text-red-800 dark:text-red-300 mb-1">Duplicaten gedetecteerd</p>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {Object.entries(duplicateGroups).map(([name, arr]) =>
                      `${arr[0].team_name} (${arr.length}x)`
                    ).join(', ')}
                    {' '}&mdash; gebruik "Samenvoegen" om duplicaten op te ruimen.
                  </p>
                </div>
              )}

              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Zoek team..."
                  className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                />
              </div>

              {/* Teams list */}
              <div className="space-y-3">
                {filteredTeams.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-400 text-center py-4">
                    {searchQuery ? 'Geen teams gevonden' : 'Nog geen teams'}
                  </p>
                ) : (
                  filteredTeams.map((team) => {
                    const teamMatchCount = matches.filter(m => m.team_id === team._id).length;
                    const isDuplicate = duplicateTeamIds.has(team._id);
                    const isExpanded = expandedTeamId === team._id;
                    const dupGroup = isDuplicate
                      ? Object.values(duplicateGroups).find(g => g.some(t => t._id === team._id))
                      : null;
                    const isTarget = dupGroup ? suggestTarget(dupGroup)._id === team._id : false;

                    return (
                      <div key={team._id}
                        className={`rounded-lg p-4 border-2 transition-all ${
                          isDuplicate
                            ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10'
                            : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                        }`}>
                        {/* Team header - clickable to expand */}
                        <div className="flex justify-between items-start cursor-pointer"
                          onClick={() => setExpandedTeamId(isExpanded ? null : team._id)}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{team.team_name}</h3>
                              {isDuplicate && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                  isTarget
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                }`}>
                                  {isTarget ? 'BEHOUDEN' : 'DUPLICAAT'}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                              <span>{team.players?.length || 0} spelers</span>
                              <span>{teamMatchCount} wedstrijden</span>
                              <span>{new Date(team._creationTime).toLocaleDateString('nl-NL')}</span>
                            </div>
                          </div>
                          <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                              <p><span className="font-medium">ID:</span> <span className="font-mono text-xs">{team._id}</span></p>
                              <p>
                                <span className="font-medium">Wachtwoord:</span>{' '}
                                <span className="font-mono">
                                  {showPasswords.has(team._id) ? team.password_hash : '••••••••'}
                                </span>
                                <button onClick={(e) => { e.stopPropagation(); togglePassword(team._id); }}
                                  className="ml-2 text-yellow-600 hover:text-yellow-700 text-xs underline">
                                  {showPasswords.has(team._id) ? 'verberg' : 'toon'}
                                </button>
                              </p>
                              <p><span className="font-medium">Aangemaakt:</span> {new Date(team._creationTime).toLocaleDateString('nl-NL', {
                                year: 'numeric', month: 'long', day: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}</p>
                              {team.players?.length > 0 && (
                                <p><span className="font-medium">Spelers:</span> {team.players.map(p => p.name).join(', ')}</p>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-2">
                              <button onClick={(e) => { e.stopPropagation(); handleRename(team); }}
                                className="px-3 py-1.5 rounded text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800">
                                Hernoem
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleResetPassword(team); }}
                                className="px-3 py-1.5 rounded text-sm font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 dark:hover:bg-yellow-800">
                                Wachtwoord
                              </button>
                              {isDuplicate && dupGroup && (
                                <button onClick={(e) => {
                                  e.stopPropagation();
                                  const target = suggestTarget(dupGroup);
                                  if (target._id === team._id) {
                                    // This is the target - merge others into this one
                                    const source = dupGroup.find(t => t._id !== team._id);
                                    if (source) handleMerge(team, source);
                                  } else {
                                    // This is a duplicate - merge into target
                                    handleMerge(target, team);
                                  }
                                }}
                                  className="px-3 py-1.5 rounded text-sm font-medium bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:hover:bg-orange-800">
                                  {isTarget ? 'Voeg duplicaat samen' : `Samenvoegen met ${suggestTarget(dupGroup).team_name}`}
                                </button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(team); }}
                                className="px-3 py-1.5 rounded text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800">
                                Verwijder
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const HomeView = () => {
    const teamMatches = matches.filter(m => m.team_id === currentTeamId);
    const [savedMatchInfo, setSavedMatchInfo] = useState(null);

    // Check for saved match when HomeView loads
    useEffect(() => {
      const savedMatchData = localStorage.getItem('korfbal_active_match');
      if (savedMatchData) {
        try {
          const parsed = JSON.parse(savedMatchData);
          if (parsed.teamId === currentTeamId && parsed.match) {
            const timeDiff = new Date() - new Date(parsed.timestamp);
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            // Only show if less than 7 days old
            if (hoursDiff < 168) {
              setSavedMatchInfo({
                opponent: parsed.match.opponent,
                score: parsed.match.score,
                opponentScore: parsed.match.opponentScore,
                hoursSince: Math.round(hoursDiff),
                matchData: parsed.match
              });
            } else {
              // Remove old saved match
              localStorage.removeItem('korfbal_active_match');
            }
          }
        } catch (e) {
          console.error('Error parsing saved match:', e);
        }
      }
    }, [currentTeamId]);

    const handleContinueSavedMatch = () => {
      if (savedMatchInfo && savedMatchInfo.matchData) {
        setCurrentMatch(savedMatchInfo.matchData);
        navigateTo('match');
        showFeedback('Wedstrijd hersteld!', 'success');
      }
    };

    const handleDiscardSavedMatch = () => {
      localStorage.removeItem('korfbal_active_match');
      setSavedMatchInfo(null);
      showFeedback('Opgeslagen wedstrijd verwijderd', 'success');
    };

    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="bg-red-600 text-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{currentTeam}</h1>
            <div className="flex items-center gap-2">
              <button onClick={toggleDarkMode} className="p-2 rounded-lg hover:bg-red-700 transition" aria-label={darkMode ? 'Lichte modus' : 'Donkere modus'}>
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={handleLogout}
                className="text-sm hover:underline min-h-[44px] px-2">Uitloggen</button>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4 pb-24 space-y-3">
          {savedMatchInfo && (
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 p-5 rounded-lg shadow-xl border-2 border-yellow-500">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className="bg-white bg-opacity-30 p-2 rounded-full mr-3">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg">Wedstrijd bezig!</p>
                    <p className="text-white text-sm opacity-90">
                      {currentTeam} - {savedMatchInfo.opponent}
                    </p>
                  </div>
                </div>
                <div className="text-center bg-white bg-opacity-20 px-4 py-2 rounded-lg">
                  <p className="text-2xl font-bold text-white">
                    {savedMatchInfo.score} - {savedMatchInfo.opponentScore}
                  </p>
                  <p className="text-xs text-white opacity-75">
                    {savedMatchInfo.hoursSince < 1
                      ? 'Net gestart'
                      : `${savedMatchInfo.hoursSince}u geleden`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleContinueSavedMatch}
                  className="flex-1 bg-white text-orange-600 py-3 rounded-lg font-bold hover:bg-gray-100 active:scale-95 transition-all shadow-md"
                >
                  ▶ Verder gaan
                </button>
                <button
                  onClick={handleDiscardSavedMatch}
                  className="bg-red-600 bg-opacity-80 text-white px-4 py-3 rounded-lg font-semibold hover:bg-opacity-100 transition"
                  aria-label="Opgeslagen wedstrijd verwijderen"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          <button onClick={() => navigateTo('setup-match')}
            className="w-full bg-white p-4 rounded-lg shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center group focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
            <div className="bg-red-600 p-3 rounded-full group-hover:bg-red-700 transition">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4 text-left">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Nieuwe wedstrijd</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Start een nieuwe wedstrijd</p>
            </div>
          </button>
          <button onClick={() => navigateTo('manage-players')}
            className="w-full bg-white p-4 rounded-lg shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center group focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
            <div className="bg-red-600 p-3 rounded-full group-hover:bg-red-700 transition">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4 text-left">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Spelers beheren</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Voeg spelers toe of bewerk ze</p>
            </div>
          </button>
          <button onClick={() => navigateTo('statistics')}
            className="w-full bg-white p-4 rounded-lg shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center group focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
            <div className="bg-red-600 p-3 rounded-full group-hover:bg-red-700 transition">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4 text-left">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Statistieken</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{teamMatches.length} wedstrijden gespeeld</p>
            </div>
          </button>
        </div>
      </div>
    );
  };

  const ManagePlayersView = () => {
    const [players, setPlayers] = useState([]);
    const [originalPlayers, setOriginalPlayers] = useState([]);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [editingPlayerId, setEditingPlayerId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [justAddedId, setJustAddedId] = useState(null);
    const animationTimerRef = useRef(null);

    // Load team data from Convex
    const currentTeamData = useQuery(
      api.teams.getTeam,
      currentTeamId ? { teamId: currentTeamId } : "skip"
    );

    // Update local state when Convex data changes
    useEffect(() => {
      if (currentTeamData) {
        const loadedPlayers = currentTeamData.players || [];
        setPlayers(loadedPlayers);
        setOriginalPlayers(loadedPlayers);
      }
    }, [currentTeamData]);

    // Cleanup animation timer on unmount
    useEffect(() => {
      return () => {
        if (animationTimerRef.current) {
          clearTimeout(animationTimerRef.current);
        }
      };
    }, []);

    const addPlayer = async () => {
      try {
        if (!currentTeamId) {
          showFeedback('Geen team geselecteerd, log opnieuw in', 'error');
          return;
        }

        if (!newPlayerName.trim()) {
          showFeedback('Vul een naam in', 'error');
          return;
        }

        if (newPlayerName.trim().length < 2) {
          showFeedback('Naam moet minimaal 2 tekens zijn', 'error');
          return;
        }

        if (players.find(p => p.name.toLowerCase() === newPlayerName.trim().toLowerCase())) {
          showFeedback('Deze speler bestaat al', 'error');
          return;
        }

        const trimmedName = newPlayerName.trim();
        const newPlayer = { id: generatePlayerId(), name: trimmedName };
        // Sanitize players: only send id and name, filter out invalid entries
        const updated = [...players, newPlayer]
          .filter(p => p.id != null && p.name)
          .map(p => ({ id: p.id, name: p.name }));

        // Direct opslaan naar database
        await updatePlayersMutation({ teamId: currentTeamId, players: updated });

        // Update lokale state + trigger animatie
        setPlayers(updated);
        setOriginalPlayers(updated);
        setNewPlayerName('');
        setJustAddedId(newPlayer.id);

        // Clear oude timer als die bestaat
        if (animationTimerRef.current) {
          clearTimeout(animationTimerRef.current);
        }

        // Start nieuwe timer
        animationTimerRef.current = setTimeout(() => {
          setJustAddedId(null);
          animationTimerRef.current = null;
        }, 2000);
      } catch (error) {
        console.error('Error adding player:', error);
        showFeedback('Fout bij toevoegen: ' + error.message, 'error');
      }
    };

    const startEditPlayer = (player) => {
      setEditingPlayerId(player.id);
      setEditingName(player.name);
    };

    const cancelEdit = () => {
      setEditingPlayerId(null);
      setEditingName('');
    };

    const saveEditPlayer = async (playerId) => {
      try {
        if (!editingName.trim()) {
          showFeedback('Vul een naam in', 'error');
          return;
        }

        if (editingName.trim().length < 2) {
          showFeedback('Naam moet minimaal 2 tekens zijn', 'error');
          return;
        }

        const trimmedName = editingName.trim();
        // Sanitize players: only send id and name, filter out invalid entries
        const updated = players.map(p =>
          p.id === playerId ? { id: p.id, name: trimmedName } : { id: p.id, name: p.name }
        ).filter(p => p.id != null && p.name);

        // Opslaan naar Convex
        await updatePlayersMutation({ teamId: currentTeamId, players: updated });

        // Update lokale state
        setPlayers(updated);
        setOriginalPlayers(updated);
        setEditingPlayerId(null);
        setEditingName('');
        showFeedback('Naam gewijzigd!', 'success');
      } catch (error) {
        console.error('Error editing player:', error);
        showFeedback('Fout bij wijzigen: ' + error.message, 'error');
      }
    };

    const removePlayer = async (id) => {
      try {
        const player = players.find(p => p.id === id);
        // Sanitize players: only send id and name, filter out invalid entries
        const updated = players.filter(p => p.id !== id)
          .filter(p => p.id != null && p.name)
          .map(p => ({ id: p.id, name: p.name }));

        // Opslaan naar Convex
        await updatePlayersMutation({ teamId: currentTeamId, players: updated });

        // Update lokale state
        setPlayers(updated);
        setOriginalPlayers(updated);
        showFeedback(player.name + ' verwijderd', 'success');
      } catch (error) {
        console.error('Error removing player:', error);
        showFeedback('Fout bij verwijderen: ' + error.message, 'error');
      }
    };

    const handleBack = () => {
      navigateTo('home');
    };

    if (currentTeamData === undefined) {
      return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
          <div className="bg-red-600 text-white p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button onClick={handleBack} className="mr-3" aria-label="Terug naar home"><ArrowLeft className="w-6 h-6" /></button>
                <h1 className="text-xl font-bold">Spelers beheren</h1>
              </div>
              <button onClick={handleLogout} className="text-sm hover:underline">Uitloggen</button>
            </div>
          </div>
          <div className="max-w-2xl mx-auto p-4 pb-24">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 text-center">
              <p className="text-gray-600 dark:text-gray-400">Laden...</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="bg-red-600 text-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button onClick={handleBack} className="mr-3" aria-label="Terug naar home"><ArrowLeft className="w-6 h-6" /></button>
              <h1 className="text-xl font-bold">Spelers beheren</h1>
            </div>
            <button onClick={handleLogout} className="text-sm hover:underline">Uitloggen</button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-4 pb-24">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-4">
            <div className="flex space-x-2 mb-4">
              <input type="text" placeholder="Naam nieuwe speler" value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                className="flex-1 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-red-600 focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-base" />
              <button onClick={addPlayer} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition" aria-label="Speler toevoegen">
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {players.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium mb-1">Nog geen spelers</p>
                  <p className="text-gray-400 text-sm">Voeg je eerste speler toe via het veld hierboven</p>
                </div>
              ) : (
                players.map(player => {
                  const isEditing = editingPlayerId === player.id;
                  const isJustAdded = justAddedId === player.id;

                  return (
                    <div
                      key={player.id}
                      className={`flex justify-between items-center p-3 rounded-lg transition-all duration-500 ${
                        isJustAdded
                          ? 'bg-green-100 border-2 border-green-500 shadow-lg'
                          : 'bg-gray-50 dark:bg-gray-700'
                      }`}
                    >
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveEditPlayer(player.id)}
                            className="flex-1 px-3 py-1 border-2 border-red-600 rounded-lg focus:outline-none text-base mr-2"
                            autoFocus
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => saveEditPlayer(player.id)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                            >
                              ✓
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="bg-gray-400 text-white px-3 py-1 rounded text-sm hover:bg-gray-500"
                            >
                              ✕
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="font-medium flex-1">{player.name}</span>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => startEditPlayer(player)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm min-h-[44px] min-w-[44px] px-2"
                            >
                              Bewerk
                            </button>
                            <button
                              onClick={() => removePlayer(player.id)}
                              className="text-red-600 hover:text-red-800 font-medium text-sm min-h-[44px] min-w-[44px] px-2"
                            >
                              Verwijder
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-sm text-blue-700">💡 Spelers worden automatisch opgeslagen wanneer je ze toevoegt of verwijdert.</p>
          </div>
        </div>
      </div>
    );
  };
  const SetupMatchView = () => {
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
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
          <div className="bg-red-600 text-white p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button onClick={() => navigateTo('home')} className="mr-3" aria-label="Terug naar home"><ArrowLeft className="w-6 h-6" /></button>
                <h1 className="text-xl font-bold">Wedstrijd instellen</h1>
              </div>
              <button onClick={handleLogout} className="text-sm hover:underline">Uitloggen</button>
            </div>
          </div>
          <div className="max-w-2xl mx-auto p-4 pb-24">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
              <p className="text-gray-600 mb-4">Je hebt nog geen spelers toegevoegd.</p>
              <button onClick={() => navigateTo('manage-players')}
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
        players: allPlayers, score: 0, opponentScore: 0, opponentGoals: [], goals: []
      });
      navigateTo('match');
      showFeedback('Wedstrijd gestart!', 'success');
    };

    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="bg-red-600 text-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button onClick={() => navigateTo('home')} className="mr-3" aria-label="Terug naar home"><ArrowLeft className="w-6 h-6" /></button>
              <h1 className="text-xl font-bold">Wedstrijd instellen</h1>
            </div>
            <button onClick={handleLogout} className="text-sm hover:underline">Uitloggen</button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-4 pb-24 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tegenstander</label>
            <input type="text" value={opponent} onChange={(e) => setOpponent(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-red-600 focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-base"
              placeholder="Naam tegenstander" />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Datum wedstrijd</label>
            <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-red-600 focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-base" />
            <p className="text-xs text-gray-500 mt-1">Selecteer de datum waarop de wedstrijd is/was gespeeld</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
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
            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 active:scale-[0.98] transition-all disabled:bg-gray-400 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
            Start wedstrijd
          </button>
        </div>
      </div>
    );
  };

  const MatchView = () => {
    const [showGoalModal, setShowGoalModal] = useState(null);
    const [showAttemptModal, setShowAttemptModal] = useState(null);
    const [showOpponentModal, setShowOpponentModal] = useState(false);
    const [showOpponentPlayerModal, setShowOpponentPlayerModal] = useState(null);
    const [actionHistory, setActionHistory] = useState([]);
    const [scoreAnimKey, setScoreAnimKey] = useState(0);

    // Guard against null match
    if (!currentMatch || !currentMatch.players) {
      return <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Geen wedstrijd gevonden</p>
          <button onClick={() => navigateTo('home')}
            className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition">
            Terug naar home
          </button>
        </div>
      </div>;
    }

    const addGoal = (playerId, shotType) => {
      // Haptic feedback on supported devices
      if (navigator.vibrate) navigator.vibrate(50);
      setCurrentMatch(prevMatch => {
        // Save current state to history
        setActionHistory(prev => [...prev, { type: 'goal', match: prevMatch }]);

        const updatedPlayers = prevMatch.players.map(p => {
          if (p.id === playerId) {
            const newStats = {
              ...p.stats,
              [shotType]: {
                goals: p.stats[shotType].goals + 1,
                attempts: p.stats[shotType].attempts + 1
              }
            };
            return { ...p, stats: newStats };
          }
          return p;
        });
        const player = prevMatch.players.find(p => p.id === playerId);
        const shotTypeName = SHOT_TYPES.find(t => t.id === shotType)?.label || shotType;
        showFeedback(`⚽ Goal voor ${player?.name || 'Onbekend'} (${shotTypeName})`, 'success');
        const newScore = prevMatch.score + 1;

        // Add timestamp to goals for chronological order
        const newGoals = [...(prevMatch.goals || []), {
          playerId,
          playerName: player?.name || 'Onbekend',
          shotType,
          timestamp: new Date().toISOString(),
          isOwn: true
        }];

        return { ...prevMatch, players: updatedPlayers, score: newScore, goals: newGoals };
      });
      setScoreAnimKey(k => k + 1);
      setShowGoalModal(null);
    };

    const addAttempt = (playerId, shotType) => {
      setCurrentMatch(prevMatch => {
        // Save current state to history
        setActionHistory(prev => [...prev, { type: 'attempt', match: prevMatch }]);

        const updatedPlayers = prevMatch.players.map(p => {
          if (p.id === playerId) {
            const newStats = {
              ...p.stats,
              [shotType]: {
                ...p.stats[shotType],
                attempts: p.stats[shotType].attempts + 1
              }
            };
            return { ...p, stats: newStats };
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
      if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
      setCurrentMatch(prevMatch => {
        // Save current state to history
        setActionHistory(prev => [...prev, { type: 'opponent_goal', match: prevMatch }]);

        const player = prevMatch.players.find(p => p.id === playerId);
        showFeedback(`Tegendoelpunt tegen ${player?.name || 'Onbekend'}`, 'error');

        // Add to chronological goals list
        const newGoals = [...(prevMatch.goals || []), {
          playerId,
          playerName: player?.name || 'Onbekend',
          shotType,
          timestamp: new Date().toISOString(),
          isOwn: false
        }];

        return {
          ...prevMatch,
          opponentScore: prevMatch.opponentScore + 1,
          opponentGoals: [...(prevMatch.opponentGoals || []), { type: shotType, time: new Date().toISOString(), concededBy: player?.name || 'Onbekend' }],
          goals: newGoals
        };
      });
      setScoreAnimKey(k => k + 1);
      setShowOpponentPlayerModal(null);
    };

    const undoLastAction = () => {
      if (actionHistory.length === 0) {
        showFeedback('Geen acties om ongedaan te maken', 'error');
        return;
      }
      const lastAction = actionHistory[actionHistory.length - 1];
      setCurrentMatch(lastAction.match);
      setActionHistory(prev => prev.slice(0, -1));
      showFeedback('Actie ongedaan gemaakt', 'success');
    };

    const finishMatch = () => {
      if (!currentMatch) {
        showFeedback('Geen wedstrijd gevonden', 'error');
        return;
      }
      showConfirm({
        title: 'Wedstrijd beëindigen',
        message: 'Wedstrijd beëindigen? Dit kan niet ongedaan gemaakt worden.',
        confirmLabel: 'Beëindigen',
        variant: 'danger',
        onConfirm: async () => {
          const success = await saveMatch(currentMatch);
          if (success) {
            navigateTo('match-summary');
          }
        }
      });
    };

    const isModalOpen = showGoalModal || showAttemptModal || showOpponentModal || showOpponentPlayerModal;

    const PlayerRow = ({ player }) => {
      const totalGoals = SHOT_TYPES.reduce((sum, type) => sum + player.stats[type.id].goals, 0);
      const totalAttempts = SHOT_TYPES.reduce((sum, type) => sum + player.stats[type.id].attempts, 0);

      return (
        <div className="border-b border-gray-200 dark:border-gray-600 py-3 last:border-0">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="font-semibold text-gray-800 dark:text-gray-100">{player.name}</span>
              <span className="text-sm text-gray-600 ml-2">{totalGoals}/{totalAttempts} pogingen</span>
            </div>
            <div className="flex space-x-2">
              <button onClick={() => setShowGoalModal(player)} disabled={isModalOpen}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
                Goal
              </button>
              <button onClick={() => setShowAttemptModal(player)} disabled={isModalOpen}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
                Poging
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {SHOT_TYPES.map(type => {
              const stat = player.stats[type.id];
              if (stat.attempts === 0) return null;
              return (
                <span key={type.id} className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  {type.short}: {stat.goals}/{stat.attempts}
                </span>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 pb-20">
        <div className="bg-red-600 text-white p-4 shadow-lg sticky top-0 z-10">
          <div className="flex justify-between items-center text-sm mb-2">
            <button onClick={() => navigateTo('home')} className="hover:underline min-h-[44px] px-2" aria-label="Terug naar home">← Home</button>
            <button onClick={handleLogout} className="hover:underline min-h-[44px] px-2">Uitloggen</button>
          </div>
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-xl font-bold">{currentMatch.team} - {currentMatch.opponent}</h1>
            {actionHistory.length > 0 && (
              <button
                onClick={undoLastAction}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1 rounded-lg text-sm font-semibold transition flex items-center gap-1"
                aria-label="Laatste actie ongedaan maken"
              >
                <ArrowLeft className="w-4 h-4" />
                Undo
              </button>
            )}
          </div>
          <div className="text-center">
            <div key={scoreAnimKey} className="text-5xl font-bold score-pop">{currentMatch.score} - {currentMatch.opponentScore}</div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-4">
            <h2 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">Basisspelers</h2>
            {currentMatch.players.filter(p => p.isStarter).map(player => <PlayerRow key={player.id} player={player} />)}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-4">
            <h2 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">Wisselspelers</h2>
            {currentMatch.players.filter(p => !p.isStarter).map(player => <PlayerRow key={player.id} player={player} />)}
          </div>
          <button onClick={() => setShowOpponentModal(true)}
            className="w-full bg-gray-800 text-white py-4 rounded-lg font-semibold hover:bg-gray-900 active:scale-[0.98] transition-all mb-4 focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2">
            + Tegendoelpunt
          </button>
          <button onClick={finishMatch}
            className="w-full bg-red-600 text-white py-4 rounded-lg font-semibold hover:bg-red-700 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
            Wedstrijd beëindigen
          </button>
        </div>
        {showGoalModal && <ShotTypeModal title="Doelpunt registreren"
          onSelect={(type) => addGoal(showGoalModal.id, type)} onClose={() => setShowGoalModal(null)} />}
        {showAttemptModal && <ShotTypeModal title="Schotpoging registreren"
          onSelect={(type) => addAttempt(showAttemptModal.id, type)} onClose={() => setShowAttemptModal(null)} />}
        {showOpponentModal && <ShotTypeModal title="Tegendoelpunt type"
          onSelect={addOpponentGoal} onClose={() => setShowOpponentModal(false)} />}
        {showOpponentPlayerModal && <PlayerSelectModal title="Wie kreeg doelpunt tegen?" players={currentMatch.players}
          onSelect={(playerId) => addOpponentGoalWithPlayer(playerId, showOpponentPlayerModal)}
          onClose={() => setShowOpponentPlayerModal(null)} />}
      </div>
    );
  };

  const ShotTypeModal = ({ title, onSelect, onClose }) => {
    const modalRef = useRef(null);

    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Tab') {
          const focusable = modalRef.current?.querySelectorAll('button');
          if (!focusable?.length) return;
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => modalRef.current?.querySelector('button')?.focus(), 50);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        role="dialog" aria-modal="true" aria-label={title} ref={modalRef}>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-sm w-full">
          <h2 className="text-lg font-bold mb-3 text-gray-800 dark:text-gray-100">{title}</h2>
          <div className="grid grid-cols-2 gap-2">
            {SHOT_TYPES.map(type => (
              <button key={type.id} onClick={() => onSelect(type.id)}
                className="bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 active:scale-95 transition-all font-semibold text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2">
                {type.label}
              </button>
            ))}
          </div>
          <button onClick={onClose}
            className="w-full mt-3 bg-gray-300 dark:bg-gray-600 text-gray-800 py-2 rounded-lg hover:bg-gray-400 active:scale-95 transition-all font-medium focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
            Annuleren
          </button>
        </div>
      </div>
    );
  };

  const PlayerSelectModal = ({ title, players, onSelect, onClose }) => {
    const modalRef = useRef(null);

    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'Tab') {
          const focusable = modalRef.current?.querySelectorAll('button');
          if (!focusable?.length) return;
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => modalRef.current?.querySelector('button')?.focus(), 50);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        role="dialog" aria-modal="true" aria-label={title} ref={modalRef}>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-sm w-full max-h-96 overflow-y-auto">
          <h2 className="text-lg font-bold mb-3 text-gray-800 dark:text-gray-100">{title}</h2>
          <div className="space-y-2">
            {players.map(player => (
              <button key={player.id} onClick={() => onSelect(player.id)}
                className="w-full bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 active:scale-95 transition-all font-semibold text-left text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2">
                {player.name}
              </button>
            ))}
          </div>
          <button onClick={onClose}
            className="w-full mt-3 bg-gray-300 dark:bg-gray-600 text-gray-800 py-2 rounded-lg hover:bg-gray-400 active:scale-95 transition-all font-medium focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
            Annuleren
          </button>
        </div>
      </div>
    );
  };
  const MatchSummaryView = () => {
    const match = currentMatch;

    if (!match || !match.players) {
      return <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Geen wedstrijd gevonden</p>
          <button onClick={() => navigateTo('home')}
            className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition">
            Terug naar home
          </button>
        </div>
      </div>;
    }

    // Use chronological goals array if available, otherwise fall back to old method
    let scoreTimeline = [];

    if (match.goals && match.goals.length > 0) {
      // New chronological method
      scoreTimeline = match.goals.map(goal => {
        const shotTypeName = SHOT_TYPES.find(t => t.id === goal.shotType)?.label || 'Onbekend';
        return {
          team: goal.isOwn ? match.team : match.opponent,
          player: goal.playerName,
          type: shotTypeName,
          isOwn: goal.isOwn,
          timestamp: goal.timestamp
        };
      });
    } else {
      // Old method for backward compatibility
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
    }

    // Calculate team statistics
    const totalGoals = match.players.reduce((sum, p) =>
      sum + SHOT_TYPES.reduce((s, type) => s + p.stats[type.id].goals, 0), 0);
    const totalAttempts = match.players.reduce((sum, p) =>
      sum + SHOT_TYPES.reduce((s, type) => s + p.stats[type.id].attempts, 0), 0);
    const teamPercentage = totalAttempts > 0 ? Math.round((totalGoals / totalAttempts) * 100) : 0;

    // Find best player
    const bestPlayer = match.players.reduce((best, player) => {
      const goals = SHOT_TYPES.reduce((sum, type) => sum + player.stats[type.id].goals, 0);
      const bestGoals = best ? SHOT_TYPES.reduce((sum, type) => sum + best.stats[type.id].goals, 0) : 0;
      return goals > bestGoals ? player : best;
    }, null);

    // Calculate stats per shot type
    const shotTypeStats = SHOT_TYPES.map(type => {
      const goals = match.players.reduce((sum, p) => sum + p.stats[type.id].goals, 0);
      const attempts = match.players.reduce((sum, p) => sum + p.stats[type.id].attempts, 0);
      const percentage = attempts > 0 ? Math.round((goals / attempts) * 100) : 0;
      return { type: type.label, goals, attempts, percentage };
    }).filter(stat => stat.attempts > 0);

    const result = match.score > match.opponentScore ? 'Gewonnen! 🎉' :
                   match.score < match.opponentScore ? 'Verloren 😔' : 'Gelijkspel';

    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="bg-red-600 text-white p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <button onClick={() => { setCurrentMatch(null); navigateTo('home'); }} className="mr-3" aria-label="Terug naar home"><ArrowLeft className="w-6 h-6" /></button>
              <h1 className="text-2xl font-bold">Wedstrijd afgelopen</h1>
            </div>
            <button onClick={handleLogout} className="text-sm hover:underline">Uitloggen</button>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">{match.score} - {match.opponentScore}</div>
            <div className="text-xl">{match.team} vs {match.opponent}</div>
            <div className="text-lg mt-2 font-semibold">{result}</div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-6">
          {/* Share button at top */}
          <button
            onClick={async () => {
              try {
                // If match already has Convex ID (_id), update it
                // Otherwise create new match first
                let matchId = match._id;

                if (!matchId) {
                  // Create match first
                  matchId = await createMatchMutation({
                    teamId: currentTeamId,
                    teamName: currentTeam,
                    opponent: match.opponent,
                    date: match.date,
                    players: match.players,
                    score: match.score,
                    opponentScore: match.opponentScore,
                    opponentGoals: match.opponentGoals || [],
                    goals: match.goals || [],
                    finished: true,
                    shareable: true,
                  });
                } else {
                  // Update existing match to be shareable
                  await updateMatchMutation({
                    matchId,
                    shareable: true,
                  });
                }

                // Generate shareable URL
                const shareUrl = `${window.location.origin}${window.location.pathname}?match=${matchId}`;

                // Copy to clipboard
                await navigator.clipboard.writeText(shareUrl);
                showFeedback('Deel-link gekopieerd! Deel deze met je team.', 'success');
              } catch (error) {
                console.error('Error sharing match:', error);
                showFeedback(`Fout bij delen: ${error.message || 'Onbekende fout'}`, 'error');
              }
            }}
            className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mb-6 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            📤 Deel wedstrijd met team
          </button>
          {/* Team Statistics */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">📊 Wedstrijdstatistieken</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{teamPercentage}%</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Team schotpercentage</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{totalAttempts}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Totaal pogingen</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{totalGoals}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Doelpunten</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-3xl font-bold text-yellow-600">{match.players.length}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Spelers ingezet</div>
              </div>
            </div>
            {bestPlayer && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">⭐ Top Scorer</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{bestPlayer.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-yellow-600">
                      {SHOT_TYPES.reduce((sum, type) => sum + bestPlayer.stats[type.id].goals, 0)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">doelpunten</div>
                  </div>
                </div>
              </div>
            )}
            {shotTypeStats.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">Schot analyse</h3>
                <div className="grid grid-cols-2 gap-3">
                  {shotTypeStats.map(stat => (
                    <div key={stat.type} className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                      <div className="font-semibold text-sm text-gray-700">{stat.type}</div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{stat.goals}/{stat.attempts}</span>
                        <span className={`text-lg font-bold ${
                          stat.percentage >= 70 ? 'text-green-600' :
                          stat.percentage >= 50 ? 'text-yellow-600' :
                          stat.percentage >= 30 ? 'text-orange-600' : 'text-red-600'
                        }`}>{stat.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Scoreverloop</h2>
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Speler statistieken</h2>
            {[...match.players].sort((a, b) => {
              const aGoals = SHOT_TYPES.reduce((sum, type) => sum + a.stats[type.id].goals, 0);
              const bGoals = SHOT_TYPES.reduce((sum, type) => sum + b.stats[type.id].goals, 0);
              return bGoals - aGoals;
            }).map(player => {
              const totalGoals = SHOT_TYPES.reduce((sum, type) => sum + player.stats[type.id].goals, 0);
              const totalAttempts = SHOT_TYPES.reduce((sum, type) => sum + player.stats[type.id].attempts, 0);
              const percentage = totalAttempts > 0 ? Math.round((totalGoals / totalAttempts) * 100) : 0;
              return (
                <div key={player.id} className="border-b border-gray-200 dark:border-gray-600 py-4 last:border-0">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-lg">{player.name}</span>
                    <span className="text-gray-600 dark:text-gray-400">{totalGoals} doelpunten / {totalAttempts} pogingen ({percentage}%)</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {SHOT_TYPES.map(type => {
                      const stat = player.stats[type.id];
                      if (stat.attempts === 0) return null;
                      return (
                        <span key={type.id} className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded">
                          {type.label}: {stat.goals}/{stat.attempts}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Tegendoelpunten overzicht</h2>
            {(match.opponentGoals || []).length > 0 ? (
              <div className="space-y-2">
                {(match.opponentGoals || []).map((goal, idx) => {
                  const shotType = SHOT_TYPES.find(t => t.id === goal.type);
                  return (
                    <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex justify-between items-center">
                      <span className="font-medium">{goal.concededBy}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{shotType?.label || 'Onbekend'}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-gray-600 dark:text-gray-400">Geen tegendoelpunten</p>}
          </div>
          <button onClick={() => { setCurrentMatch(null); navigateTo('home'); }}
            className="w-full bg-red-600 text-white py-4 rounded-lg font-semibold hover:bg-red-700 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
            Terug naar home
          </button>
        </div>
      </div>
    );
  };

  const SkeletonCard = ({ lines = 3 }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 rounded mb-3" style={{ width: `${80 - i * 15}%` }}></div>
      ))}
    </div>
  );

  const StatisticsView = () => {
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [matchSearch, setMatchSearch] = useState('');
    const [matchFilter, setMatchFilter] = useState('all'); // 'all' | 'won' | 'lost' | 'draw'
    const [comparePlayer1, setComparePlayer1] = useState('');
    const [comparePlayer2, setComparePlayer2] = useState('');

    // Memoize team matches filter
    const teamMatches = useMemo(() => {
      return matches.filter(m => m.team_id === currentTeamId);
    }, [matches, currentTeamId]);

    // Memoize expensive player stats calculation
    const playerStats = useMemo(() => {
      const stats = {};

      teamMatches.forEach(match => {
        if (!match.players || !Array.isArray(match.players)) return;
        match.players.forEach(player => {
          if (!player || !player.name) return;
          if (!stats[player.name]) {
            stats[player.name] = {
              matches: 0, goals: 0, attempts: 0,
              byType: SHOT_TYPES.reduce((acc, type) => ({ ...acc, [type.id]: { goals: 0, attempts: 0 } }), {})
            };
          }
          stats[player.name].matches++;
          SHOT_TYPES.forEach(type => {
            const typeStats = player.stats?.[type.id] || { goals: 0, attempts: 0 };
            stats[player.name].goals += typeStats.goals || 0;
            stats[player.name].attempts += typeStats.attempts || 0;
            stats[player.name].byType[type.id].goals += typeStats.goals || 0;
            stats[player.name].byType[type.id].attempts += typeStats.attempts || 0;
          });
        });
      });

      return stats;
    }, [teamMatches]);

    // Memoize team totals
    const totalGoals = useMemo(() => teamMatches.reduce((sum, m) => sum + m.score, 0), [teamMatches]);
    const totalAgainst = useMemo(() => teamMatches.reduce((sum, m) => sum + m.opponent_score, 0), [teamMatches]);
    const wins = useMemo(() => teamMatches.filter(m => m.score > m.opponent_score).length, [teamMatches]);
    const losses = useMemo(() => teamMatches.filter(m => m.score < m.opponent_score).length, [teamMatches]);
    const draws = useMemo(() => teamMatches.filter(m => m.score === m.opponent_score).length, [teamMatches]);

    const handleDeleteMatch = (match) => {
      showConfirm({
        title: 'Wedstrijd verwijderen',
        message: 'Weet je zeker dat je deze wedstrijd wilt verwijderen?',
        onConfirm: async () => {
          await deleteMatch(match._id);
          if (selectedMatch && selectedMatch._id === match._id) setSelectedMatch(null);
        }
      });
    };

    const exportToCSV = () => {
      try {
        // Header
        let csv = 'Team Statistieken - ' + currentTeam + '\n\n';

        // Team overzicht
        csv += 'Team Overzicht\n';
        csv += 'Wedstrijden,Gewonnen,Gelijkspel,Verloren,Doelpunten Voor,Doelpunten Tegen\n';
        csv += teamMatches.length + ',' + wins + ',' + draws + ',' + losses + ',' + totalGoals + ',' + totalAgainst + '\n\n';

        // Speler statistieken
        csv += 'Speler Statistieken\n';
        csv += 'Naam,Wedstrijden,Doelpunten,Pogingen,Percentage';
        SHOT_TYPES.forEach(type => {
          csv += ',' + type.label + ' Doelpunten,' + type.label + ' Pogingen';
        });
        csv += '\n';

        Object.entries(playerStats)
          .sort(([, a], [, b]) => b.goals - a.goals)
          .forEach(([name, stats]) => {
            const percentage = stats.attempts > 0 ? Math.round((stats.goals / stats.attempts) * 100) : 0;
            csv += name + ',' + stats.matches + ',' + stats.goals + ',' + stats.attempts + ',' + percentage + '%';
            SHOT_TYPES.forEach(type => {
              const typeStat = stats.byType[type.id];
              csv += ',' + typeStat.goals + ',' + typeStat.attempts;
            });
            csv += '\n';
          });

        // Wedstrijd geschiedenis
        csv += '\n\nWedstrijd Geschiedenis\n';
        csv += 'Datum,Tegenstander,Uitslag,Resultaat\n';
        [...teamMatches]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .forEach(match => {
            const date = new Date(match.date).toLocaleDateString('nl-NL');
            const result = match.score > match.opponent_score ? 'Gewonnen' :
                          match.score < match.opponent_score ? 'Verloren' : 'Gelijkspel';
            csv += date + ',' + match.opponent + ',' + match.score + '-' + match.opponent_score + ',' + result + '\n';
          });

        // Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', currentTeam + '_statistieken_' + new Date().toISOString().split('T')[0] + '.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showFeedback('Statistieken geëxporteerd!', 'success');
      } catch (error) {
        console.error('Export error:', error);
        showFeedback('Fout bij exporteren', 'error');
      }
    };

    if (selectedMatch) {
      return <MatchDetailView match={selectedMatch} onBack={() => setSelectedMatch(null)}
        onDelete={() => handleDeleteMatch(selectedMatch)} />;
    }

    const isLoading = teamMatches === undefined || (teamMatches.length === 0 && !teamMatches);

    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="bg-red-600 text-white p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <button onClick={() => navigateTo('home')} className="mr-4" aria-label="Terug naar home"><ArrowLeft className="w-6 h-6" /></button>
              <h1 className="text-2xl font-bold">Statistieken</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                className="bg-white text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center space-x-2"
              >
                <Download className="w-5 h-5" />
                <span>Exporteer</span>
              </button>
              <button onClick={handleLogout} className="text-sm hover:underline">Uitloggen</button>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-6 pb-24 space-y-6">
          {teamMatches === undefined ? (
            <>
              <SkeletonCard lines={4} />
              <SkeletonCard lines={5} />
              <SkeletonCard lines={3} />
            </>
          ) : teamMatches.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Nog geen statistieken</h2>
              <p className="text-gray-500 mb-6">Speel je eerste wedstrijd om statistieken te verzamelen</p>
              <button onClick={() => navigateTo('setup-match')}
                className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 active:scale-95 transition-all">
                Nieuwe wedstrijd starten
              </button>
            </div>
          ) : (
          <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Team overzicht</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{teamMatches.length}</div>
                <div className="text-gray-600 dark:text-gray-400">Wedstrijden</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{wins}</div>
                <div className="text-gray-600 dark:text-gray-400">Gewonnen</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">{draws}</div>
                <div className="text-gray-600 dark:text-gray-400">Gelijk</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-800">{losses}</div>
                <div className="text-gray-600 dark:text-gray-400">Verloren</div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{totalGoals}</div>
                <div className="text-gray-600 dark:text-gray-400">Doelpunten voor</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">{totalAgainst}</div>
                <div className="text-gray-600 dark:text-gray-400">Doelpunten tegen</div>
              </div>
            </div>
          </div>
          {/* Prestatie trend grafiek */}
          {teamMatches.length >= 2 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Prestatie per wedstrijd</h2>
              <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
                {[...teamMatches]
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .slice(-10)
                  .map((m, i) => {
                    const totalAttempts = m.players?.reduce((sum, p) =>
                      sum + SHOT_TYPES.reduce((s, t) => s + (p.stats?.[t.id]?.attempts || 0), 0), 0) || 0;
                    const totalGoals = m.players?.reduce((sum, p) =>
                      sum + SHOT_TYPES.reduce((s, t) => s + (p.stats?.[t.id]?.goals || 0), 0), 0) || 0;
                    const pct = totalAttempts > 0 ? Math.round((totalGoals / totalAttempts) * 100) : 0;
                    const won = m.score > m.opponent_score;
                    const lost = m.score < m.opponent_score;
                    return (
                      <div key={m._id || i} className="flex flex-col items-center flex-1 min-w-[36px]" title={`${m.opponent}: ${m.score}-${m.opponent_score} (${pct}%)`}>
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{pct}%</span>
                        <div className="w-full flex flex-col items-center" style={{ height: '100px' }}>
                          <div
                            className={`w-full max-w-[28px] rounded-t transition-all duration-500 ${
                              won ? 'bg-green-500' : lost ? 'bg-red-400' : 'bg-gray-400'
                            }`}
                            style={{ height: `${Math.max(pct, 4)}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate w-full text-center">{m.opponent?.substring(0, 4)}</span>
                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{m.score}-{m.opponent_score}</span>
                      </div>
                    );
                  })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded"></div> Gewonnen</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400 rounded"></div> Verloren</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-400 rounded"></div> Gelijk</div>
              </div>
            </div>
          )}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Speler statistieken</h2>
            <div className="space-y-4">
              {Object.entries(playerStats).sort(([, a], [, b]) => b.goals - a.goals).map(([name, stats], index) => {
                const percentage = stats.attempts > 0 ? Math.round((stats.goals / stats.attempts) * 100) : 0;
                const avgPerMatch = stats.matches > 0 ? (stats.goals / stats.matches).toFixed(1) : 0;

                // Bepaal kleur op basis van percentage
                let performanceColor = 'bg-gray-400';
                let performanceText = 'text-gray-700';
                if (percentage >= 70) {
                  performanceColor = 'bg-green-500';
                  performanceText = 'text-green-700';
                } else if (percentage >= 50) {
                  performanceColor = 'bg-yellow-500';
                  performanceText = 'text-yellow-700';
                } else if (percentage >= 30) {
                  performanceColor = 'bg-orange-500';
                  performanceText = 'text-orange-700';
                } else if (stats.attempts > 0) {
                  performanceColor = 'bg-red-500';
                  performanceText = 'text-red-700';
                }

                // Ranking badge styling
                let rankBadge = 'bg-gray-200 text-gray-700';
                if (index === 0) rankBadge = 'bg-yellow-400 text-yellow-900 font-bold';
                else if (index === 1) rankBadge = 'bg-gray-300 dark:bg-gray-600 text-gray-800 font-bold';
                else if (index === 2) rankBadge = 'bg-orange-300 text-orange-900 font-bold';

                return (
                  <div key={name} className="border-l-4 border-red-600 bg-gray-50 dark:bg-gray-700 p-4 rounded-r-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm ${rankBadge}`}>
                          #{index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-lg">{name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {stats.matches} wedstrijden • {avgPerMatch} doelpunten/wedstrijd
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-600">{stats.goals}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">doelpunten</div>
                      </div>
                    </div>

                    {/* Progress bar voor score percentage */}
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-400">Scorepercentage</span>
                        <span className={`font-semibold ${performanceText}`}>{percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full ${performanceColor} transition-all duration-500 rounded-full`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {stats.goals} van {stats.attempts} pogingen
                      </div>
                    </div>

                    {/* Shot type details */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      {SHOT_TYPES.map(type => {
                        const typeStat = stats.byType[type.id];
                        if (typeStat.attempts === 0) return null;
                        const typePercentage = Math.round((typeStat.goals / typeStat.attempts) * 100);

                        let typeColor = 'bg-gray-100 border-gray-300 dark:border-gray-600';
                        if (typePercentage >= 70) typeColor = 'bg-green-50 border-green-300';
                        else if (typePercentage >= 50) typeColor = 'bg-yellow-50 border-yellow-300';
                        else if (typePercentage >= 30) typeColor = 'bg-orange-50 border-orange-300';
                        else typeColor = 'bg-red-50 border-red-300';

                        return (
                          <div key={type.id} className={`${typeColor} border px-2 py-1 rounded text-xs`}>
                            <div className="font-semibold">{type.short}</div>
                            <div>{typeStat.goals}/{typeStat.attempts} ({typePercentage}%)</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Speler vergelijking */}
          {Object.keys(playerStats).length >= 2 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Spelers vergelijken</h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <select value={comparePlayer1} onChange={(e) => setComparePlayer1(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-red-600 focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-sm">
                  <option value="">Speler 1</option>
                  {Object.keys(playerStats).map(name => (
                    <option key={name} value={name} disabled={name === comparePlayer2}>{name}</option>
                  ))}
                </select>
                <select value={comparePlayer2} onChange={(e) => setComparePlayer2(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-red-600 focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-sm">
                  <option value="">Speler 2</option>
                  {Object.keys(playerStats).map(name => (
                    <option key={name} value={name} disabled={name === comparePlayer1}>{name}</option>
                  ))}
                </select>
              </div>
              {comparePlayer1 && comparePlayer2 && playerStats[comparePlayer1] && playerStats[comparePlayer2] && (() => {
                const p1 = playerStats[comparePlayer1];
                const p2 = playerStats[comparePlayer2];
                const p1Pct = p1.attempts > 0 ? Math.round((p1.goals / p1.attempts) * 100) : 0;
                const p2Pct = p2.attempts > 0 ? Math.round((p2.goals / p2.attempts) * 100) : 0;
                const comparisons = [
                  { label: 'Doelpunten', v1: p1.goals, v2: p2.goals },
                  { label: 'Pogingen', v1: p1.attempts, v2: p2.attempts },
                  { label: 'Percentage', v1: p1Pct, v2: p2Pct, suffix: '%' },
                  { label: 'Wedstrijden', v1: p1.matches, v2: p2.matches },
                  { label: 'Gem/wedstrijd', v1: p1.matches > 0 ? (p1.goals / p1.matches).toFixed(1) : 0, v2: p2.matches > 0 ? (p2.goals / p2.matches).toFixed(1) : 0 },
                ];
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 text-center text-sm font-semibold mb-2">
                      <span className="text-red-600 dark:text-red-400">{comparePlayer1}</span>
                      <span className="text-gray-500 dark:text-gray-400">vs</span>
                      <span className="text-blue-600 dark:text-blue-400">{comparePlayer2}</span>
                    </div>
                    {comparisons.map(c => {
                      const v1 = parseFloat(c.v1), v2 = parseFloat(c.v2);
                      const max = Math.max(v1, v2, 1);
                      return (
                        <div key={c.label}>
                          <div className="text-xs text-center text-gray-500 dark:text-gray-400 mb-1">{c.label}</div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold w-12 text-right ${v1 > v2 ? 'text-green-600' : v1 < v2 ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
                              {c.v1}{c.suffix || ''}
                            </span>
                            <div className="flex-1 flex h-5 gap-0.5">
                              <div className="flex-1 flex justify-end">
                                <div className="bg-red-500 rounded-l h-full transition-all duration-500" style={{ width: `${(v1 / max) * 100}%` }}></div>
                              </div>
                              <div className="flex-1">
                                <div className="bg-blue-500 rounded-r h-full transition-all duration-500" style={{ width: `${(v2 / max) * 100}%` }}></div>
                              </div>
                            </div>
                            <span className={`text-sm font-bold w-12 ${v2 > v1 ? 'text-green-600' : v2 < v1 ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
                              {c.v2}{c.suffix || ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {/* Per shot type vergelijking */}
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 text-center">Per schottype</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {SHOT_TYPES.map(type => {
                          const s1 = p1.byType[type.id], s2 = p2.byType[type.id];
                          if (s1.attempts === 0 && s2.attempts === 0) return null;
                          const pct1 = s1.attempts > 0 ? Math.round((s1.goals / s1.attempts) * 100) : 0;
                          const pct2 = s2.attempts > 0 ? Math.round((s2.goals / s2.attempts) * 100) : 0;
                          return (
                            <div key={type.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 flex justify-between items-center">
                              <span className="font-semibold text-gray-700 dark:text-gray-300">{type.short}</span>
                              <span className={pct1 > pct2 ? 'text-green-600 font-bold' : 'text-gray-500 dark:text-gray-400'}>{s1.goals}/{s1.attempts}</span>
                              <span className="text-gray-400">vs</span>
                              <span className={pct2 > pct1 ? 'text-green-600 font-bold' : 'text-gray-500 dark:text-gray-400'}>{s2.goals}/{s2.attempts}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {(!comparePlayer1 || !comparePlayer2) && (
                <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-4">Selecteer twee spelers om te vergelijken</p>
              )}
            </div>
          )}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Wedstrijd geschiedenis</h2>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Zoek op tegenstander..."
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-red-600 focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-sm focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                />
              </div>
              <div className="flex gap-1">
                {[
                  { id: 'all', label: 'Alle' },
                  { id: 'won', label: 'Gewonnen' },
                  { id: 'draw', label: 'Gelijk' },
                  { id: 'lost', label: 'Verloren' },
                ].map(f => (
                  <button key={f.id} onClick={() => setMatchFilter(f.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      matchFilter === f.id ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {[...teamMatches]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .filter(m => {
                  if (matchSearch && !m.opponent.toLowerCase().includes(matchSearch.toLowerCase())) return false;
                  if (matchFilter === 'won' && m.score <= m.opponent_score) return false;
                  if (matchFilter === 'lost' && m.score >= m.opponent_score) return false;
                  if (matchFilter === 'draw' && m.score !== m.opponent_score) return false;
                  return true;
                })
                .map((match) => (
                <div key={match._id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex justify-between items-start gap-3">
                    <button onClick={() => setSelectedMatch(match)} className="flex-1 text-left">
                      <div className="font-semibold">{match.team_name} vs {match.opponent}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{new Date(match.date).toLocaleDateString('nl-NL')}</div>
                    </button>
                    <div className="flex items-center gap-3">
                      <div className={`text-xl font-bold whitespace-nowrap ${
                        match.score > match.opponent_score ? 'text-green-600' :
                        match.score < match.opponent_score ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {match.score} - {match.opponent_score}
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await updateMatchMutation({
                              matchId: match._id,
                              shareable: true,
                            });
                            const shareUrl = `${window.location.origin}${window.location.pathname}?match=${match._id}`;
                            await navigator.clipboard.writeText(shareUrl);
                            showFeedback('Deel-link gekopieerd!', 'success');
                          } catch (error) {
                            showFeedback('Fout bij delen', 'error');
                          }
                        }}
                        className="text-green-600 hover:text-green-800 text-sm font-medium min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Deel wedstrijd"
                        aria-label="Deel wedstrijd"
                      >
                        📤
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteMatch(match); }}
                        className="text-red-600 hover:text-red-800 text-sm font-medium min-h-[44px] min-w-[44px] flex items-center justify-center" title="Verwijder wedstrijd" aria-label="Verwijder wedstrijd">✕</button>
                    </div>
                  </div>
                </div>
              ))}
              {teamMatches.length > 0 && [...teamMatches].filter(m => {
                if (matchSearch && !m.opponent.toLowerCase().includes(matchSearch.toLowerCase())) return false;
                if (matchFilter === 'won' && m.score <= m.opponent_score) return false;
                if (matchFilter === 'lost' && m.score >= m.opponent_score) return false;
                if (matchFilter === 'draw' && m.score !== m.opponent_score) return false;
                return true;
              }).length === 0 && (
                <p className="text-center text-gray-500 py-4">Geen wedstrijden gevonden</p>
              )}
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    );
  };

  const SharedMatchView = () => {
    const match = currentMatch;

    if (!match || !match.players) {
      return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Geen wedstrijd gevonden</p>
            <button
              onClick={() => {
                window.history.replaceState({}, '', window.location.pathname);
                navigateTo('login');
                setCurrentMatch(null);
              }}
              className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition"
            >
              Ga naar login
            </button>
          </div>
        </div>
      );
    }

    // Use chronological goals array if available, otherwise fall back to old method
    let scoreTimeline = [];

    if (match.goals && match.goals.length > 0) {
      scoreTimeline = match.goals.map(goal => {
        const shotTypeName = SHOT_TYPES.find(t => t.id === goal.shotType)?.label || 'Onbekend';
        return {
          team: goal.isOwn ? match.team_name : match.opponent,
          player: goal.playerName,
          type: shotTypeName,
          isOwn: goal.isOwn,
          timestamp: goal.timestamp
        };
      });
    } else {
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
    }

    // Calculate team statistics
    const totalGoals = match.players.reduce((sum, p) =>
      sum + SHOT_TYPES.reduce((s, type) => s + (p.stats?.[type.id]?.goals || 0), 0), 0);
    const totalAttempts = match.players.reduce((sum, p) =>
      sum + SHOT_TYPES.reduce((s, type) => s + (p.stats?.[type.id]?.attempts || 0), 0), 0);
    const teamPercentage = totalAttempts > 0 ? Math.round((totalGoals / totalAttempts) * 100) : 0;

    // Find best player
    const bestPlayer = match.players.reduce((best, player) => {
      const goals = SHOT_TYPES.reduce((sum, type) => sum + (player.stats?.[type.id]?.goals || 0), 0);
      const bestGoals = best ? SHOT_TYPES.reduce((sum, type) => sum + (best.stats?.[type.id]?.goals || 0), 0) : 0;
      return goals > bestGoals ? player : best;
    }, null);

    // Calculate stats per shot type
    const shotTypeStats = SHOT_TYPES.map(type => {
      const goals = match.players.reduce((sum, p) => sum + (p.stats?.[type.id]?.goals || 0), 0);
      const attempts = match.players.reduce((sum, p) => sum + (p.stats?.[type.id]?.attempts || 0), 0);
      const percentage = attempts > 0 ? Math.round((goals / attempts) * 100) : 0;
      return { type: type.label, goals, attempts, percentage };
    }).filter(stat => stat.attempts > 0);

    const result = match.score > match.opponent_score ? 'Gewonnen! 🎉' :
                   match.score < match.opponent_score ? 'Verloren 😔' : 'Gelijkspel';

    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="bg-red-600 text-white p-6 shadow-lg">
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">{match.score} - {match.opponent_score}</div>
            <div className="text-xl">{match.team_name} vs {match.opponent}</div>
            <div className="text-lg mt-2 font-semibold">{result}</div>
            <div className="text-sm opacity-90 mt-2">
              {new Date(match.date).toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="mt-4 p-3 bg-white bg-opacity-20 rounded-lg">
              <p className="text-sm">Gedeeld door {match.team_name}</p>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-6">
          {/* Team Statistics */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">📊 Wedstrijdstatistieken</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{teamPercentage}%</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Team schotpercentage</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{totalAttempts}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Totaal pogingen</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{totalGoals}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Doelpunten</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-3xl font-bold text-yellow-600">{match.players.length}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Spelers ingezet</div>
              </div>
            </div>
            {bestPlayer && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">⭐ Top Scorer</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{bestPlayer.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-yellow-600">
                      {SHOT_TYPES.reduce((sum, type) => sum + (bestPlayer.stats?.[type.id]?.goals || 0), 0)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">doelpunten</div>
                  </div>
                </div>
              </div>
            )}
            {shotTypeStats.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">Schot analyse</h3>
                <div className="grid grid-cols-2 gap-3">
                  {shotTypeStats.map(stat => (
                    <div key={stat.type} className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                      <div className="font-semibold text-sm text-gray-700">{stat.type}</div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{stat.goals}/{stat.attempts}</span>
                        <span className={`text-lg font-bold ${
                          stat.percentage >= 70 ? 'text-green-600' :
                          stat.percentage >= 50 ? 'text-yellow-600' :
                          stat.percentage >= 30 ? 'text-orange-600' : 'text-red-600'
                        }`}>{stat.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scoreverloop */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Scoreverloop</h2>
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

          {/* Player stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Speler statistieken</h2>
            {[...match.players].sort((a, b) => {
              const aGoals = SHOT_TYPES.reduce((sum, type) => sum + (a.stats?.[type.id]?.goals || 0), 0);
              const bGoals = SHOT_TYPES.reduce((sum, type) => sum + (b.stats?.[type.id]?.goals || 0), 0);
              return bGoals - aGoals;
            }).map(player => {
              const totalGoals = SHOT_TYPES.reduce((sum, type) => sum + (player.stats?.[type.id]?.goals || 0), 0);
              const totalAttempts = SHOT_TYPES.reduce((sum, type) => sum + (player.stats?.[type.id]?.attempts || 0), 0);
              const percentage = totalAttempts > 0 ? Math.round((totalGoals / totalAttempts) * 100) : 0;
              return (
                <div key={player.id} className="border-b border-gray-200 dark:border-gray-600 py-4 last:border-0">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-lg">{player.name}</span>
                    <span className="text-gray-600 dark:text-gray-400">{totalGoals} doelpunten / {totalAttempts} pogingen ({percentage}%)</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {SHOT_TYPES.map(type => {
                      const stat = player.stats?.[type.id];
                      if (!stat || stat.attempts === 0) return null;
                      return (
                        <span key={type.id} className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded">
                          {type.label}: {stat.goals}/{stat.attempts}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-6">
            <p className="text-sm text-blue-800">
              💡 Wil jij ook je korfbalwedstrijden bijhouden? Maak een gratis account aan!
            </p>
          </div>

          <button
            onClick={() => {
              window.history.replaceState({}, '', window.location.pathname);
              navigateTo('login');
              setCurrentMatch(null);
            }}
            className="w-full bg-red-600 text-white py-4 rounded-lg font-semibold hover:bg-red-700 transition"
          >
            Ga naar login
          </button>
        </div>
      </div>
    );
  };

  const MatchDetailView = ({ match, onBack, onDelete }) => {
    if (!match || !match.players) {
      return <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Geen wedstrijd gevonden</p>
      </div>;
    }

    // Use chronological goals array if available, otherwise fall back to old method
    let scoreTimeline = [];

    if (match.goals && match.goals.length > 0) {
      // New chronological method
      scoreTimeline = match.goals.map(goal => {
        const shotTypeName = SHOT_TYPES.find(t => t.id === goal.shotType)?.label || 'Onbekend';
        return {
          team: goal.isOwn ? match.team_name : match.opponent,
          player: goal.playerName,
          type: shotTypeName,
          isOwn: goal.isOwn,
          timestamp: goal.timestamp
        };
      });
    } else {
      // Old method for backward compatibility
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
    }

    // Calculate team statistics
    const totalGoals = match.players.reduce((sum, p) =>
      sum + SHOT_TYPES.reduce((s, type) => s + (p.stats?.[type.id]?.goals || 0), 0), 0);
    const totalAttempts = match.players.reduce((sum, p) =>
      sum + SHOT_TYPES.reduce((s, type) => s + (p.stats?.[type.id]?.attempts || 0), 0), 0);
    const teamPercentage = totalAttempts > 0 ? Math.round((totalGoals / totalAttempts) * 100) : 0;

    // Find best player
    const bestPlayer = match.players.reduce((best, player) => {
      const goals = SHOT_TYPES.reduce((sum, type) => sum + (player.stats?.[type.id]?.goals || 0), 0);
      const bestGoals = best ? SHOT_TYPES.reduce((sum, type) => sum + (best.stats?.[type.id]?.goals || 0), 0) : 0;
      return goals > bestGoals ? player : best;
    }, null);

    // Calculate stats per shot type
    const shotTypeStats = SHOT_TYPES.map(type => {
      const goals = match.players.reduce((sum, p) => sum + (p.stats?.[type.id]?.goals || 0), 0);
      const attempts = match.players.reduce((sum, p) => sum + (p.stats?.[type.id]?.attempts || 0), 0);
      const percentage = attempts > 0 ? Math.round((goals / attempts) * 100) : 0;
      return { type: type.label, goals, attempts, percentage };
    }).filter(stat => stat.attempts > 0);

    const result = match.score > match.opponent_score ? 'Gewonnen! 🎉' :
                   match.score < match.opponent_score ? 'Verloren 😔' : 'Gelijkspel';

    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="bg-red-600 text-white p-6 shadow-lg">
          <button onClick={onBack} className="mb-2 flex items-center text-white hover:underline">
            <ArrowLeft className="w-5 h-5 mr-2" /><span>Terug</span>
          </button>
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">{match.score} - {match.opponent_score}</div>
            <div className="text-xl">{match.team_name} vs {match.opponent}</div>
            <div className="text-lg mt-2 font-semibold">{result}</div>
            <div className="text-sm opacity-90 mt-2">
              {new Date(match.date).toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-6">
          {/* Team Statistics */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">📊 Wedstrijdstatistieken</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{teamPercentage}%</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Team schotpercentage</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{totalAttempts}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Totaal pogingen</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{totalGoals}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Doelpunten</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-3xl font-bold text-yellow-600">{match.players.length}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Spelers ingezet</div>
              </div>
            </div>
            {bestPlayer && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">⭐ Top Scorer</div>
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{bestPlayer.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-yellow-600">
                      {SHOT_TYPES.reduce((sum, type) => sum + (bestPlayer.stats?.[type.id]?.goals || 0), 0)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">doelpunten</div>
                  </div>
                </div>
              </div>
            )}
            {shotTypeStats.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-3">Schot analyse</h3>
                <div className="grid grid-cols-2 gap-3">
                  {shotTypeStats.map(stat => (
                    <div key={stat.type} className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                      <div className="font-semibold text-sm text-gray-700">{stat.type}</div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{stat.goals}/{stat.attempts}</span>
                        <span className={`text-lg font-bold ${
                          stat.percentage >= 70 ? 'text-green-600' :
                          stat.percentage >= 50 ? 'text-yellow-600' :
                          stat.percentage >= 30 ? 'text-orange-600' : 'text-red-600'
                        }`}>{stat.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scoreverloop */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Scoreverloop</h2>
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

          {/* Player stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Speler statistieken</h2>
            {[...match.players].sort((a, b) => {
              const aGoals = SHOT_TYPES.reduce((sum, type) => sum + (a.stats?.[type.id]?.goals || 0), 0);
              const bGoals = SHOT_TYPES.reduce((sum, type) => sum + (b.stats?.[type.id]?.goals || 0), 0);
              return bGoals - aGoals;
            }).map(player => {
              const totalGoals = SHOT_TYPES.reduce((sum, type) => sum + (player.stats?.[type.id]?.goals || 0), 0);
              const totalAttempts = SHOT_TYPES.reduce((sum, type) => sum + (player.stats?.[type.id]?.attempts || 0), 0);
              const percentage = totalAttempts > 0 ? Math.round((totalGoals / totalAttempts) * 100) : 0;
              return (
                <div key={player.id} className="border-b border-gray-200 dark:border-gray-600 py-4 last:border-0">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-lg">{player.name}</span>
                    <span className="text-gray-600 dark:text-gray-400">{totalGoals} doelpunten / {totalAttempts} pogingen ({percentage}%)</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {SHOT_TYPES.map(type => {
                      const stat = player.stats?.[type.id];
                      if (!stat || stat.attempts === 0) return null;
                      return (
                        <span key={type.id} className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded">
                          {type.label}: {stat.goals}/{stat.attempts}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Opponent goals */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Tegendoelpunten overzicht</h2>
            {(match.opponent_goals || []).length > 0 ? (
              <div className="space-y-2">
                {(match.opponent_goals || []).map((goal, idx) => {
                  const shotType = SHOT_TYPES.find(t => t.id === goal.type);
                  return (
                    <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex justify-between items-center">
                      <span className="font-medium">{goal.concededBy}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{shotType?.label || 'Onbekend'}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-gray-600 dark:text-gray-400">Geen tegendoelpunten</p>}
          </div>

          {/* Deel wedstrijd knop */}
          <button
            onClick={async () => {
              try {
                // Update match to be shareable
                await updateMatchMutation({
                  matchId: match._id,
                  shareable: true,
                });

                // Generate shareable URL
                const shareUrl = `${window.location.origin}${window.location.pathname}?match=${match._id}`;

                // Copy to clipboard
                await navigator.clipboard.writeText(shareUrl);
                showFeedback('Deel-link gekopieerd! Deel deze met je team.', 'success');
              } catch (error) {
                console.error('Error sharing match:', error);
                showFeedback(`Fout bij delen: ${error.message || 'Onbekende fout'}`, 'error');
              }
            }}
            className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2 mb-3"
          >
            📤 Deel wedstrijd met team
          </button>

          <button onClick={onDelete}
            className="w-full bg-red-600 text-white py-4 rounded-lg font-semibold hover:bg-red-700 transition">
            Wedstrijd verwijderen
          </button>
        </div>
      </div>
    );
  };

  // Views that show the bottom navigation bar
  const bottomNavViews = ['home', 'manage-players', 'setup-match', 'statistics'];
  const showBottomNav = bottomNavViews.includes(view);

  const BottomNav = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 z-40 pb-[env(safe-area-inset-bottom)]" aria-label="Hoofdnavigatie">
      <div className="flex justify-around max-w-lg mx-auto">
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'setup-match', icon: Plus, label: 'Wedstrijd' },
          { id: 'statistics', icon: BarChart3, label: 'Stats' },
          { id: 'manage-players', icon: Users, label: 'Spelers' },
        ].map(item => {
          const Icon = item.icon;
          const isActive = view === item.id;
          return (
            <button key={item.id} onClick={() => navigateTo(item.id)}
              className={`flex flex-col items-center py-2 px-3 min-h-[56px] min-w-[64px] transition-colors ${
                isActive ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <div>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {feedback?.message}
      </div>
      {feedback && (
        <div
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg max-w-sm w-full mx-4 transition-opacity duration-300 ${
            feedback.type === 'success' ? 'bg-green-600 text-white' :
            feedback.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
          } ${feedback.visible === false ? 'opacity-0' : 'opacity-100'}`}
          role="status"
        >
          <p className="font-medium text-center text-sm">{feedback.message}</p>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
      <InputDialog
        isOpen={inputDialog.isOpen}
        title={inputDialog.title}
        message={inputDialog.message}
        placeholder={inputDialog.placeholder}
        inputType={inputDialog.inputType}
        onSubmit={inputDialog.onSubmit}
        onCancel={() => setInputDialog(prev => ({ ...prev, isOpen: false }))}
      />
      <div key={view} className="page-transition">
        {view === 'login' && <LoginView />}
        {view === 'god-mode' && <GodModeView />}
        {view === 'home' && <HomeView />}
        {view === 'manage-players' && <ManagePlayersView />}
        {view === 'setup-match' && <SetupMatchView />}
        {view === 'match' && <MatchView />}
        {view === 'match-summary' && <MatchSummaryView />}
        {view === 'statistics' && <StatisticsView />}
        {view === 'shared-match' && <SharedMatchView />}
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
