import React, { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Trophy, Users, BarChart3, Plus, ArrowLeft, Download, Home, Search, Moon, Sun, Cog } from 'lucide-react';
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useClerk, SignIn, SignUp } from "@clerk/clerk-react";
import { api } from "../convex/_generated/api";
import { SHOT_TYPES } from './constants/shotTypes';
import { generatePlayerId } from './utils/generatePlayerId';
import { exportMatchesCSV } from './utils/exportCSV';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { SettingsSheet } from './components/ui/SettingsSheet';

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
              className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-dark active:scale-95 transition-all">
              Pagina herladen
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Safe accessor for player stats (handles missing outstart in legacy matches)
const getStat = (player, typeId) => player.stats[typeId] || { goals: 0, attempts: 0 };

// Custom hook for debouncing values
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// generatePlayerId is imported from ./utils/generatePlayerId

// ConfirmDialog is imported from ./components/ui/ConfirmDialog

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

// Standalone feedback toast – keeps its own state so it never re-renders KorfbalApp
const FeedbackToast = forwardRef(function FeedbackToast(_props, ref) {
  const [feedback, setFeedback] = useState(null);
  const timers = useRef({ fade: null, remove: null });

  useImperativeHandle(ref, () => ({
    show(message, type = 'error') {
      if (timers.current.fade) clearTimeout(timers.current.fade);
      if (timers.current.remove) clearTimeout(timers.current.remove);
      setFeedback({ message, type, visible: true });
      timers.current.fade = setTimeout(() => {
        setFeedback(prev => prev ? { ...prev, visible: false } : null);
      }, 2700);
      timers.current.remove = setTimeout(() => {
        setFeedback(null);
      }, 3000);
    },
  }));

  if (!feedback) return null;
  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">{feedback.message}</div>
      <div
        role="status"
        className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg max-w-sm w-full mx-4 transition-opacity duration-300 ${
          feedback.type === 'success' ? 'bg-green-600 text-white' :
          feedback.type === 'error'   ? 'bg-red-600 text-white'   : 'bg-blue-600 text-white'
        } ${feedback.visible === false ? 'opacity-0' : 'opacity-100'}`}
      >
        <p className="font-medium text-center text-sm">{feedback.message}</p>
      </div>
    </>
  );
});

export default function KorfbalApp() {
  const [view, setView] = useState('login');
  const [currentTeam, setCurrentTeam] = useState(null);
  const [currentTeamId, setCurrentTeamId] = useState(null);
  const [currentMatch, setCurrentMatch] = useState(null);
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
  const [colorTheme, setColorTheme] = useState(() => {
    return localStorage.getItem('korfbal_color_theme') || 'red';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [forceOnboarding, setForceOnboarding] = useState(false);
  const feedbackRef = useRef(null);

  // Apply dark mode class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('korfbal_dark_mode', darkMode);
  }, [darkMode]);

  // Apply color theme to document
  useEffect(() => {
    if (colorTheme === 'red') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', colorTheme);
    }
    localStorage.setItem('korfbal_color_theme', colorTheme);
  }, [colorTheme]);

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

  // Clerk auth state — must be declared BEFORE any useQuery that depends on isAuthenticated
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useClerk();

  // Teams for current Clerk user (drives post-login routing)
  const userTeams = useQuery(
    api.memberships.getUserTeams,
    isAuthenticated ? {} : "skip"
  );

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


  // Views that require authentication
  const authRequiredViews = ['home', 'manage-players', 'setup-match', 'match', 'match-summary', 'statistics'];

  // Browser history navigation support (back/forward buttons)
  useEffect(() => {
    const handlePopState = (event) => {
      const targetView = event.state?.view || window.location.hash.substring(1);
      if (targetView) {
        // Prevent navigating to auth-required views without a team selected
        if (authRequiredViews.includes(targetView) && !currentTeamId) {
          setView('home'); // Will show onboarding/picker based on auth state
        } else {
          setView(targetView);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    // Set initial state — start at home; Clerk routing handles the rest
    const initialHash = window.location.hash.substring(1);
    if (initialHash && !authRequiredViews.includes(initialHash)) {
      setView(initialHash);
    } else if (!initialHash) {
      window.history.replaceState({ view: 'home' }, '', '#home');
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

  // Check for shared match URL on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const matchId = urlParams.get('match');
    if (matchId) {
      setSharedMatchId(matchId);
    }
    // Clean up old localStorage session data (migration from old auth system)
    localStorage.removeItem('korfbal_session');
  }, []);

  // Clerk-based team auto-selection after login
  useEffect(() => {
    if (!isAuthenticated || userTeams === undefined) return; // still loading
    if (currentTeamId) return; // already have a team selected

    if (userTeams.length === 1) {
      // Only one team → auto-select
      setCurrentTeam(userTeams[0].teamName);
      setCurrentTeamId(userTeams[0].teamId);
      if (view === 'login' || view === 'onboarding') navigateTo('home');
    }
    // 0 teams → OnboardingView (handled in routing)
    // 2+ teams → TeamPickerView (handled in routing)
  }, [isAuthenticated, userTeams, currentTeamId]);

  // Handle ?invite=TOKEN URL parameter after Clerk login
  useEffect(() => {
    if (!isAuthenticated) return;
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');
    if (!inviteToken) return;

    // Clear invite token from URL immediately
    window.history.replaceState({}, '', window.location.pathname);

    acceptInviteMutation({ token: inviteToken })
      .then(({ teamId }) => {
        // Reload userTeams by forcing a re-select on next render
        setCurrentTeamId(null);
        setCurrentTeam(null);
        showFeedback('Welkom bij het team!', 'success');
      })
      .catch((e) => showFeedback(e.message || 'Uitnodiging ongeldig', 'error'));
  }, [isAuthenticated]);

  // Handle shared match data once loaded
  useEffect(() => {
    if (sharedMatchData) {
      setCurrentMatch(sharedMatchData);
      navigateTo('shared-match');
    }
  }, [sharedMatchData]);

  const showFeedback = useCallback((message, type = 'error') => {
    feedbackRef.current?.show(message, type);
  }, []);

  // Convex mutations
  const loginMutation = useMutation(api.auth.login); // God Mode only
  const createTeamMutation = useMutation(api.memberships.createTeam);
  const claimTeamMutation = useMutation(api.memberships.claimTeam);
  const acceptInviteMutation = useMutation(api.memberships.acceptInvite);
  const updatePlayersMutation = useMutation(api.teams.updatePlayers);
  const deleteTeamMutation = useMutation(api.teams.deleteTeam);
  const resetPasswordMutation = useMutation(api.teams.resetPassword);
  const renameTeamMutation = useMutation(api.teams.renameTeam);
  const mergeTeamsMutation = useMutation(api.teams.mergeTeams);
  const cleanDuplicateTeamsMutation = useMutation(api.teams.cleanDuplicateTeams);
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
    if (!currentTeamId) {
      showFeedback('Niet ingelogd – log opnieuw in', 'error');
      return false;
    }
    try {
      // Skip save if match is already in the database
      if (match._id) {
        localStorage.removeItem('korfbal_active_match');
        showFeedback('Wedstrijd opgeslagen', 'success');
        return true;
      }
      // Normalize all data against the current Convex schema (guards against stale localStorage data)
      const normalizedPlayers = (match.players || []).map(p => ({
        id: p.id,
        name: p.name ?? 'Onbekend',
        isStarter: p.isStarter ?? false,
        stats: SHOT_TYPES.reduce((acc, type) => ({
          ...acc,
          [type.id]: {
            goals: Number(p.stats?.[type.id]?.goals) || 0,
            attempts: Number(p.stats?.[type.id]?.attempts) || 0,
          }
        }), {})
      })).filter(p => p.id !== undefined && p.id !== null);

      const normalizedGoals = (match.goals || [])
        .filter(g => g.playerId !== undefined && g.playerId !== null)
        .map(g => ({
          playerId: g.playerId,
          playerName: g.playerName ?? 'Onbekend',
          shotType: g.shotType ?? 'other',
          timestamp: g.timestamp ?? new Date().toISOString(),
          isOwn: g.isOwn ?? false,
        }));

      const normalizedOpponentGoals = (match.opponentGoals || []).map(g => ({
        type: g.type ?? 'other',
        time: g.time ?? new Date().toISOString(),
        concededBy: g.concededBy ?? 'Onbekend',
      }));

      const payload = {
        teamId: currentTeamId,
        teamName: currentTeam ?? '',
        opponent: match.opponent ?? '',
        date: match.date ?? new Date().toISOString(),
        players: normalizedPlayers,
        score: Number(match.score) || 0,
        opponentScore: Number(match.opponentScore) || 0,
        opponentGoals: normalizedOpponentGoals,
        goals: normalizedGoals,
        finished: true,
        shareable: false,
      };
      console.error('saveMatch payload:', JSON.stringify(payload, null, 2));
      const matchId = await createMatchMutation(payload);
      // Update currentMatch with database ID to prevent duplicate creation
      setCurrentMatch(prev => prev ? { ...prev, _id: matchId } : prev);
      // Clear localStorage after successful save
      localStorage.removeItem('korfbal_active_match');
      showFeedback('Wedstrijd opgeslagen', 'success');
      return true;
    } catch (e) {
      console.error('saveMatch fout – message:', e.message);
      console.error('saveMatch fout – data:', e.data);
      console.error('saveMatch fout – full:', e);
      showFeedback('Fout bij opslaan – zie browser console (F12)', 'error');
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
  // ─── OnboardingView: create a new team or claim an existing one ───
  const OnboardingView = () => {
    const [mode, setMode] = useState('new'); // 'new' | 'claim'
    const [teamName, setTeamName] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);

    const handleCreateTeam = async () => {
      if (!teamName.trim()) { showFeedback('Vul een teamnaam in', 'error'); return; }
      setBusy(true);
      try {
        const result = await createTeamMutation({ teamName: teamName.trim() });
        setCurrentTeam(result.teamName);
        setCurrentTeamId(result.teamId);
        setForceOnboarding(false);
        navigateTo('home');
        showFeedback(`Team "${result.teamName}" aangemaakt!`, 'success');
      } catch (e) {
        showFeedback(e.message || 'Fout bij aanmaken team', 'error');
      }
      setBusy(false);
    };

    const handleClaimTeam = async () => {
      if (!teamName.trim() || !password) { showFeedback('Vul teamnaam en wachtwoord in', 'error'); return; }
      setBusy(true);
      try {
        const result = await claimTeamMutation({ teamName: teamName.trim(), password });
        setCurrentTeam(result.teamName);
        setCurrentTeamId(result.teamId);
        setForceOnboarding(false);
        navigateTo('home');
        showFeedback(`Team "${result.teamName}" succesvol gekoppeld!`, 'success');
      } catch (e) {
        showFeedback(e.message || 'Fout bij koppelen team', 'error');
      }
      setBusy(false);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Welkom!</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Maak een nieuw team aan of koppel een bestaand team.</p>
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 mb-6">
            <button
              onClick={() => setMode('new')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === 'new' ? 'bg-primary text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              Nieuw team
            </button>
            <button
              onClick={() => setMode('claim')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${mode === 'claim' ? 'bg-primary text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              Bestaand team
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teamnaam</label>
              <input
                type="text"
                placeholder={mode === 'new' ? 'Bijv. KV Winnaars' : 'Naam van je huidige team'}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && mode === 'new' && handleCreateTeam()}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary focus:outline-none dark:bg-gray-700 dark:text-gray-100"
                autoFocus
              />
            </div>

            {mode === 'claim' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Oud wachtwoord</label>
                <input
                  type="password"
                  placeholder="Het wachtwoord van voor de update"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleClaimTeam()}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary focus:outline-none dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            )}

            <button
              onClick={mode === 'new' ? handleCreateTeam : handleClaimTeam}
              disabled={busy}
              className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark active:scale-95 transition-all disabled:opacity-50"
            >
              {busy ? 'Bezig...' : (mode === 'new' ? 'Team aanmaken' : 'Team koppelen')}
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
            <button onClick={() => signOut()} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              Uitloggen
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── TeamPickerView: choose a team when user belongs to multiple ───
  const TeamPickerView = () => (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <Trophy className="w-12 h-12 text-primary mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Kies een team</h1>
        </div>
        <div className="space-y-3">
          {(userTeams || []).map((t) => (
            <button
              key={t.teamId}
              onClick={() => {
                setCurrentTeam(t.teamName);
                setCurrentTeamId(t.teamId);
                navigateTo('home');
              }}
              className="w-full text-left px-5 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary transition group"
            >
              <div className="font-semibold text-gray-800 dark:text-gray-100 group-hover:text-primary">{t.teamName}</div>
              <div className="text-xs text-gray-400 capitalize mt-0.5">{t.role === 'admin' ? 'Beheerder' : 'Lid'}</div>
            </button>
          ))}
          <button
            onClick={() => setForceOnboarding(true)}
            className="w-full py-3 text-sm text-primary hover:underline"
          >
            + Nieuw team aanmaken
          </button>
        </div>
        <div className="mt-4 text-center">
          <button onClick={() => signOut()} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            Uitloggen
          </button>
        </div>
      </div>
    </div>
  );

  const handleLogout = useCallback(async () => {
    localStorage.removeItem('korfbal_active_match');
    setCurrentTeam(null);
    setCurrentTeamId(null);
    setCurrentMatch(null);
    await signOut();
  }, [signOut]);

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
              <div className="grid grid-cols-3 gap-3 mb-4">
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
                  <p className={`text-xs ${dupCount > 0 ? 'text-primary dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>Duplicaten</p>
                </div>
              </div>
              {dupCount > 0 && (
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={() => showConfirm({
                      title: 'Dubbele teams opschonen',
                      message: 'Per teamnaam wordt het team met de meeste wedstrijden bewaard. De overige duplicaten en hun wedstrijden worden permanent verwijderd.',
                      confirmLabel: 'Opschonen',
                      onConfirm: async () => {
                        try {
                          const result = await cleanDuplicateTeamsMutation({});
                          showFeedback(`Opgeschoond: ${result.deletedTeams} teams en ${result.deletedMatches} wedstrijden verwijderd`, 'success');
                        } catch (e) {
                          showFeedback('Fout bij opschonen: ' + (e.message || e), 'error');
                        }
                      }
                    })}
                    className="bg-yellow-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-yellow-700"
                  >
                    Dubbelen verwijderen
                  </button>
                </div>
              )}

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
        <div className="bg-primary text-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{currentTeam}</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg hover:bg-primary-dark transition"
                aria-label="Instellingen openen"
              >
                <Cog className="w-5 h-5" />
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
                  className="bg-primary bg-opacity-80 text-white px-4 py-3 rounded-lg font-semibold hover:bg-opacity-100 transition"
                  aria-label="Opgeslagen wedstrijd verwijderen"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          <button onClick={() => navigateTo('setup-match')}
            className="w-full bg-white p-4 rounded-lg shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center group focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <div className="bg-primary p-3 rounded-full group-hover:bg-primary-dark transition">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4 text-left">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Nieuwe wedstrijd</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Start een nieuwe wedstrijd</p>
            </div>
          </button>
          <button onClick={() => navigateTo('manage-players')}
            className="w-full bg-white p-4 rounded-lg shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center group focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <div className="bg-primary p-3 rounded-full group-hover:bg-primary-dark transition">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4 text-left">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Spelers beheren</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Voeg spelers toe of bewerk ze</p>
            </div>
          </button>
          <button onClick={() => navigateTo('statistics')}
            className="w-full bg-white p-4 rounded-lg shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center group focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <div className="bg-primary p-3 rounded-full group-hover:bg-primary-dark transition">
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

    const removePlayer = (id) => {
      const player = players.find(p => p.id === id);
      showConfirm({
        title: 'Speler verwijderen',
        message: `${player?.name || 'Deze speler'} verwijderen uit je team?`,
        confirmLabel: 'Verwijderen',
        variant: 'danger',
        onConfirm: async () => {
          try {
            // Sanitize players: only send id and name, filter out invalid entries
            const updated = players.filter(p => p.id !== id)
              .filter(p => p.id != null && p.name)
              .map(p => ({ id: p.id, name: p.name }));

            // Opslaan naar Convex
            await updatePlayersMutation({ teamId: currentTeamId, players: updated });

            // Update lokale state
            setPlayers(updated);
            setOriginalPlayers(updated);
            showFeedback((player?.name || 'Speler') + ' verwijderd', 'success');
          } catch (error) {
            console.error('Error removing player:', error);
            showFeedback('Fout bij verwijderen: ' + error.message, 'error');
          }
        }
      });
    };

    const handleBack = () => {
      navigateTo('home');
    };

    if (currentTeamData === undefined) {
      return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
          <div className="bg-primary text-white p-4 shadow-lg">
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
        <div className="bg-primary text-white p-4 shadow-lg">
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
                className="flex-1 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-base" />
              <button onClick={addPlayer} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition" aria-label="Speler toevoegen">
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
                            className="flex-1 px-3 py-1 border-2 border-primary rounded-lg focus:outline-none text-base mr-2"
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
                              className="text-primary hover:text-red-800 font-medium text-sm min-h-[44px] min-w-[44px] px-2"
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
          <div className="bg-primary text-white p-4 shadow-lg">
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
                className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-dark transition">
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
        <div className="bg-primary text-white p-4 shadow-lg">
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
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-base"
              placeholder="Naam tegenstander" />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Datum wedstrijd</label>
            <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-base" />
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
                      ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}>
                  {player.name}
                </button>
              ))}
            </div>
          </div>
          <button onClick={startMatch} disabled={!opponent || selectedPlayers.length !== 8}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark active:scale-[0.98] transition-all disabled:bg-gray-400 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
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
            className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-dark transition">
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
      const totalGoals = SHOT_TYPES.reduce((sum, type) => sum + getStat(player, type.id).goals, 0);
      const totalAttempts = SHOT_TYPES.reduce((sum, type) => sum + getStat(player, type.id).attempts, 0);

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
              const stat = getStat(player, type.id);
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
        <div className="bg-primary text-white p-4 shadow-lg sticky top-0 z-10">
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
            className="w-full bg-primary text-white py-4 rounded-lg font-semibold hover:bg-primary-dark active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
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
                className="bg-primary text-white p-3 rounded-lg hover:bg-primary-dark active:scale-95 transition-all font-semibold text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2">
                {type.label}
              </button>
            ))}
          </div>
          <button onClick={onClose}
            className="w-full mt-3 bg-gray-300 dark:bg-gray-600 text-gray-800 py-2 rounded-lg hover:bg-gray-400 active:scale-95 transition-all font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
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
                className="w-full bg-primary text-white p-3 rounded-lg hover:bg-primary-dark active:scale-95 transition-all font-semibold text-left text-sm focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2">
                {player.name}
              </button>
            ))}
          </div>
          <button onClick={onClose}
            className="w-full mt-3 bg-gray-300 dark:bg-gray-600 text-gray-800 py-2 rounded-lg hover:bg-gray-400 active:scale-95 transition-all font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
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
            className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-dark transition">
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
          const goals = getStat(player, type.id).goals;
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
      sum + SHOT_TYPES.reduce((s, type) => s + getStat(p, type.id).goals, 0), 0);
    const totalAttempts = match.players.reduce((sum, p) =>
      sum + SHOT_TYPES.reduce((s, type) => s + getStat(p, type.id).attempts, 0), 0);
    const teamPercentage = totalAttempts > 0 ? Math.round((totalGoals / totalAttempts) * 100) : 0;

    // Find best player
    const bestPlayer = match.players.reduce((best, player) => {
      const goals = SHOT_TYPES.reduce((sum, type) => sum + getStat(player, type.id).goals, 0);
      const bestGoals = best ? SHOT_TYPES.reduce((sum, type) => sum + getStat(best, type.id).goals, 0) : 0;
      return goals > bestGoals ? player : best;
    }, null);

    // Calculate stats per shot type
    const shotTypeStats = SHOT_TYPES.map(type => {
      const goals = match.players.reduce((sum, p) => sum + getStat(p, type.id).goals, 0);
      const attempts = match.players.reduce((sum, p) => sum + getStat(p, type.id).attempts, 0);
      const percentage = attempts > 0 ? Math.round((goals / attempts) * 100) : 0;
      return { type: type.label, goals, attempts, percentage };
    }).filter(stat => stat.attempts > 0);

    const result = match.score > match.opponentScore ? 'Gewonnen! 🎉' :
                   match.score < match.opponentScore ? 'Verloren 😔' : 'Gelijkspel';

    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="bg-primary text-white p-6 shadow-lg">
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
                  const normPlayers = (match.players || []).map(p => ({
                    id: p.id,
                    name: p.name,
                    isStarter: p.isStarter ?? false,
                    stats: SHOT_TYPES.reduce((acc, type) => ({
                      ...acc,
                      [type.id]: { goals: Number(p.stats?.[type.id]?.goals) || 0, attempts: Number(p.stats?.[type.id]?.attempts) || 0 }
                    }), {})
                  })).filter(p => p.id !== undefined && p.id !== null);
                  const normGoals = (match.goals || []).filter(g => g.playerId !== undefined && g.playerId !== null).map(g => ({
                    playerId: g.playerId, playerName: g.playerName ?? 'Onbekend',
                    shotType: g.shotType ?? 'other', timestamp: g.timestamp ?? new Date().toISOString(), isOwn: g.isOwn ?? false,
                  }));
                  const normOppGoals = (match.opponentGoals || []).map(g => ({
                    type: g.type ?? 'other', time: g.time ?? new Date().toISOString(), concededBy: g.concededBy ?? 'Onbekend',
                  }));
                  matchId = await createMatchMutation({
                    teamId: currentTeamId,
                    teamName: currentTeam ?? '',
                    opponent: match.opponent ?? '',
                    date: match.date ?? new Date().toISOString(),
                    players: normPlayers,
                    score: Number(match.score) || 0,
                    opponentScore: Number(match.opponentScore) || 0,
                    opponentGoals: normOppGoals,
                    goals: normGoals,
                    finished: true,
                    shareable: true,
                  });
                  setCurrentMatch(prev => prev ? { ...prev, _id: matchId } : prev);
                  localStorage.removeItem('korfbal_active_match');
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
                <div className="text-3xl font-bold text-primary">{teamPercentage}%</div>
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
                      {SHOT_TYPES.reduce((sum, type) => sum + getStat(bestPlayer, type.id).goals, 0)}
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
                          stat.percentage >= 30 ? 'text-orange-600' : 'text-primary'
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
                  <div key={idx} className={`p-3 rounded-lg ${goal.isOwn ? 'bg-green-50 border-l-4 border-green-600' : 'bg-red-50 border-l-4 border-primary'}`}>
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
              const aGoals = SHOT_TYPES.reduce((sum, type) => sum + getStat(a, type.id).goals, 0);
              const bGoals = SHOT_TYPES.reduce((sum, type) => sum + getStat(b, type.id).goals, 0);
              return bGoals - aGoals;
            }).map(player => {
              const totalGoals = SHOT_TYPES.reduce((sum, type) => sum + getStat(player, type.id).goals, 0);
              const totalAttempts = SHOT_TYPES.reduce((sum, type) => sum + getStat(player, type.id).attempts, 0);
              const percentage = totalAttempts > 0 ? Math.round((totalGoals / totalAttempts) * 100) : 0;
              return (
                <div key={player.id} className="border-b border-gray-200 dark:border-gray-600 py-4 last:border-0">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-lg">{player.name}</span>
                    <span className="text-gray-600 dark:text-gray-400">{totalGoals} doelpunten / {totalAttempts} pogingen ({percentage}%)</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {SHOT_TYPES.map(type => {
                      const stat = getStat(player, type.id);
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
            className="w-full bg-primary text-white py-4 rounded-lg font-semibold hover:bg-primary-dark active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
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
    const [expandedPlayer, setExpandedPlayer] = useState(null);

    // Server-side stats queries
    const formLast5 = useQuery(api.stats.getFormLastN, currentTeamId ? { teamId: currentTeamId, n: 5 } : 'skip');
    const opponentStats = useQuery(api.stats.getOpponentStats, currentTeamId ? { teamId: currentTeamId } : 'skip');
    const playerOfMonth = useQuery(api.stats.getPlayerOfMonth, currentTeamId ? { teamId: currentTeamId } : 'skip');
    const topPlayers = useQuery(api.stats.getTopPlayers, currentTeamId ? { teamId: currentTeamId, limit: 5 } : 'skip');
    // Fase 4 — nieuwe stats
    const trendByMonth = useQuery(api.stats.getTrendByMonth, currentTeamId ? { teamId: currentTeamId } : 'skip');
    const shotTypeTrend = useQuery(api.stats.getShotTypeTrend, currentTeamId ? { teamId: currentTeamId, n: 10 } : 'skip');
    const careerStats = useQuery(api.stats.getPlayerCareerStats, currentTeamId ? { teamId: currentTeamId } : 'skip');

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
        exportMatchesCSV(teamMatches, currentTeam);
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
        <div className="bg-primary text-white p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <button onClick={() => navigateTo('home')} className="mr-4" aria-label="Terug naar home"><ArrowLeft className="w-6 h-6" /></button>
              <h1 className="text-2xl font-bold">Statistieken</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                className="bg-white text-primary px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center space-x-2"
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
                className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-dark active:scale-95 transition-all">
                Nieuwe wedstrijd starten
              </button>
            </div>
          ) : (
          <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Team overzicht</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{teamMatches.length}</div>
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
                <div className="text-3xl font-bold text-primary">{totalGoals}</div>
                <div className="text-gray-600 dark:text-gray-400">Doelpunten voor</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">{totalAgainst}</div>
                <div className="text-gray-600 dark:text-gray-400">Doelpunten tegen</div>
              </div>
            </div>
          </div>
          {/* Vorm-strip: laatste 5 wedstrijden */}
          {formLast5 && formLast5.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Vorm laatste {formLast5.length} wedstrijden</h2>
              <div className="flex items-center gap-3 flex-wrap">
                {formLast5.map((m, i) => (
                  <div key={m.matchId || i} className="flex flex-col items-center gap-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow ${
                      m.result === 'W' ? 'bg-green-500' : m.result === 'D' ? 'bg-gray-400' : 'bg-red-500'
                    }`}>
                      {m.result}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{m.score}-{m.opponentScore}</span>
                    <span className="text-[10px] text-gray-400 truncate max-w-[48px] text-center">{m.opponent.substring(0, 6)}</span>
                  </div>
                ))}
                <div className="ml-auto text-sm text-gray-500 dark:text-gray-400 flex gap-3">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>W</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400 inline-block"></span>G</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>V</span>
                </div>
              </div>
            </div>
          )}

          {/* Speler van de maand */}
          {playerOfMonth && (
            <div className="bg-gradient-to-r from-primary to-primary-dark text-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-bold mb-1 opacity-90">🏆 Speler van de maand</h2>
              <p className="text-3xl font-extrabold">{playerOfMonth.name}</p>
              <p className="text-sm opacity-80 mt-1">{playerOfMonth.goals} doelpunten in de afgelopen 30 dagen</p>
            </div>
          )}

          {/* Beste spelers top 5 */}
          {topPlayers && topPlayers.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Top 5 scorers (dit seizoen)</h2>
              <div className="space-y-3">
                {topPlayers.map((p, i) => (
                  <div key={p.playerId} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-gray-300 text-gray-700'
                    }`}>{i + 1}</span>
                    <span className="flex-1 font-medium text-gray-800 dark:text-gray-100">{p.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{p.goals} doelpunten</span>
                    <span className="text-sm font-semibold text-primary">{p.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Maandelijkse trend SVG grafiek */}
          {trendByMonth && trendByMonth.length >= 2 && (() => {
            const maxGoals = Math.max(...trendByMonth.flatMap(m => [m.goalsFor, m.goalsAgainst]), 1);
            const W = 300, H = 100, padX = 8, padY = 8;
            const plotW = W - padX * 2;
            const plotH = H - padY * 2;
            const n = trendByMonth.length;
            const xStep = n > 1 ? plotW / (n - 1) : 0;
            const yScale = (v) => padY + plotH - (v / maxGoals) * plotH;
            const xAt = (i) => padX + i * xStep;

            const pointsFor = trendByMonth.map((m, i) => `${xAt(i)},${yScale(m.goalsFor)}`).join(' ');
            const pointsAgainst = trendByMonth.map((m, i) => `${xAt(i)},${yScale(m.goalsAgainst)}`).join(' ');

            // Filled area paths
            const areaFor = `M${padX},${H - padY} ` +
              trendByMonth.map((m, i) => `L${xAt(i)},${yScale(m.goalsFor)}`).join(' ') +
              ` L${xAt(n - 1)},${H - padY} Z`;
            const areaAgainst = `M${padX},${H - padY} ` +
              trendByMonth.map((m, i) => `L${xAt(i)},${yScale(m.goalsAgainst)}`).join(' ') +
              ` L${xAt(n - 1)},${H - padY} Z`;

            return (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold mb-1 text-gray-800 dark:text-gray-100">Doelpunten per maand</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Gemiddeld per wedstrijd · {trendByMonth.length} maanden</p>
                <div className="overflow-x-auto">
                  <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full max-w-xl" aria-hidden="true">
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                      <line key={frac}
                        x1={padX} y1={yScale(maxGoals * frac)}
                        x2={W - padX} y2={yScale(maxGoals * frac)}
                        stroke="currentColor" strokeOpacity="0.1" strokeWidth="1"
                      />
                    ))}
                    {/* Area fills */}
                    <path d={areaFor} fill="#22c55e" fillOpacity="0.12" />
                    <path d={areaAgainst} fill="#ef4444" fillOpacity="0.12" />
                    {/* Lines */}
                    <polyline points={pointsFor} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points={pointsAgainst} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Dots */}
                    {trendByMonth.map((m, i) => (
                      <g key={i}>
                        <circle cx={xAt(i)} cy={yScale(m.goalsFor)} r="3" fill="#22c55e" />
                        <circle cx={xAt(i)} cy={yScale(m.goalsAgainst)} r="3" fill="#ef4444" />
                      </g>
                    ))}
                    {/* X-axis labels */}
                    {trendByMonth.map((m, i) => (
                      <text key={i} x={xAt(i)} y={H + 16}
                        textAnchor="middle" fontSize="8" fill="currentColor" fillOpacity="0.5"
                      >
                        {m.month}
                      </text>
                    ))}
                  </svg>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-green-500 inline-block rounded"></span>Voor</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-400 inline-block rounded"></span>Tegen</span>
                </div>
              </div>
            );
          })()}

          {/* Tegenstander tabel */}
          {opponentStats && opponentStats.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Resultaten per tegenstander</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                      <th className="text-left pb-2">Tegenstander</th>
                      <th className="text-center pb-2">Gespeeld</th>
                      <th className="text-center pb-2 text-green-600">W</th>
                      <th className="text-center pb-2 text-gray-500">G</th>
                      <th className="text-center pb-2 text-red-500">V</th>
                      <th className="text-right pb-2">Win%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opponentStats.map((o) => (
                      <tr key={o.name} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="py-2 font-medium text-gray-800 dark:text-gray-100">{o.name}</td>
                        <td className="py-2 text-center text-gray-600 dark:text-gray-400">{o.played}</td>
                        <td className="py-2 text-center text-green-600 font-semibold">{o.wins}</td>
                        <td className="py-2 text-center text-gray-500">{o.draws}</td>
                        <td className="py-2 text-center text-red-500">{o.losses}</td>
                        <td className="py-2 text-right">
                          <span className={`font-bold ${o.winPercentage >= 50 ? 'text-green-600' : o.winPercentage >= 30 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {o.winPercentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Schot-type trend tabel */}
          {shotTypeTrend && teamMatches.length >= 3 && (() => {
            const usedMatches = shotTypeTrend[0]?.usedMatches ?? 10;
            const anyData = shotTypeTrend.some(s => s.season.attempts > 0);
            if (!anyData) return null;
            return (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold mb-1 text-gray-800 dark:text-gray-100">Schot-type trend</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Laatste {usedMatches} wedstr. vs heel seizoen · {teamMatches.length} wedstrijden totaal
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                        <th className="text-left pb-2">Schottype</th>
                        <th className="text-center pb-2">Seizoen%</th>
                        <th className="text-center pb-2">Laatste {usedMatches}%</th>
                        <th className="text-right pb-2">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shotTypeTrend.filter(s => s.season.attempts > 0).map((s) => (
                        <tr key={s.shotType} className="border-b dark:border-gray-700">
                          <td className="py-2 text-gray-800 dark:text-gray-100">
                            <span className="font-medium">{s.label}</span>
                            <span className="ml-1.5 text-xs text-gray-400">{s.short}</span>
                          </td>
                          <td className="py-2 text-center text-gray-600 dark:text-gray-400">{s.season.pct}%</td>
                          <td className="py-2 text-center font-semibold text-gray-800 dark:text-gray-100">
                            {s.recent.attempts > 0 ? `${s.recent.pct}%` : '–'}
                          </td>
                          <td className="py-2 text-right">
                            {s.recent.attempts === 0 ? (
                              <span className="text-gray-400 text-xs">geen data</span>
                            ) : s.trend === 'up' ? (
                              <span className="text-green-600 font-bold text-base">↑</span>
                            ) : s.trend === 'down' ? (
                              <span className="text-red-500 font-bold text-base">↓</span>
                            ) : (
                              <span className="text-gray-400 font-bold">–</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                  ↑ verbeterd (&gt;3%) · ↓ verslechterd (&gt;3%) · – stabiel
                </p>
              </div>
            );
          })()}

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

                const isExpanded = expandedPlayer === name;
                const career = careerStats?.find(c => c.name === name);

                return (
                  <div key={name} className="border-l-4 border-primary bg-gray-50 dark:bg-gray-700 p-4 rounded-r-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm ${rankBadge}`}>
                          #{index + 1}
                        </div>
                        <div className="flex-1">
                          <button
                            className="font-bold text-lg text-left flex items-center gap-1 hover:text-primary transition-colors"
                            onClick={() => setExpandedPlayer(isExpanded ? null : name)}
                            aria-expanded={isExpanded}
                          >
                            {name}
                            <span className={`text-xs text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                          </button>
                          <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 flex-wrap">
                            <span>{stats.matches} wedstrijden • {avgPerMatch} doelpunten/wedstrijd</span>
                            {career?.bestShotTypeLabel && (
                              <span className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded font-medium">
                                ★ {career.bestShotTypeLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">{stats.goals}</div>
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

                    {/* Shot type details — uitklapbaar */}
                    {isExpanded && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm mt-1">
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
                    )}
                    {!isExpanded && stats.attempts > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Klik op naam voor schottype details
                      </p>
                    )}
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
                  className="px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-sm">
                  <option value="">Speler 1</option>
                  {Object.keys(playerStats).map(name => (
                    <option key={name} value={name} disabled={name === comparePlayer2}>{name}</option>
                  ))}
                </select>
                <select value={comparePlayer2} onChange={(e) => setComparePlayer2(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-sm">
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
                      <span className="text-primary dark:text-red-400">{comparePlayer1}</span>
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
                  className="w-full pl-9 pr-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
                      matchFilter === f.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                        match.score < match.opponent_score ? 'text-primary' : 'text-gray-600'
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
                        className="text-primary hover:text-red-800 text-sm font-medium min-h-[44px] min-w-[44px] flex items-center justify-center" title="Verwijder wedstrijd" aria-label="Verwijder wedstrijd">✕</button>
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
              className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-dark transition"
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
        <div className="bg-primary text-white p-6 shadow-lg">
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
                <div className="text-3xl font-bold text-primary">{teamPercentage}%</div>
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
                          stat.percentage >= 30 ? 'text-orange-600' : 'text-primary'
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
                  <div key={idx} className={`p-3 rounded-lg ${goal.isOwn ? 'bg-green-50 border-l-4 border-green-600' : 'bg-red-50 border-l-4 border-primary'}`}>
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
            className="w-full bg-primary text-white py-4 rounded-lg font-semibold hover:bg-primary-dark transition"
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
        <div className="bg-primary text-white p-6 shadow-lg">
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
                <div className="text-3xl font-bold text-primary">{teamPercentage}%</div>
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
                          stat.percentage >= 30 ? 'text-orange-600' : 'text-primary'
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
                  <div key={idx} className={`p-3 rounded-lg ${goal.isOwn ? 'bg-green-50 border-l-4 border-green-600' : 'bg-red-50 border-l-4 border-primary'}`}>
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
            className="w-full bg-primary text-white py-4 rounded-lg font-semibold hover:bg-primary-dark transition">
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
                isActive ? 'text-primary dark:text-primary-text' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
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
      <FeedbackToast ref={feedbackRef} />
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
      <SettingsSheet
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        colorTheme={colorTheme}
        setColorTheme={setColorTheme}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        currentTeamId={currentTeamId}
        onFeedback={showFeedback}
      />
      <div key={view} className="page-transition">
        {/* Shared match — always public, no auth needed */}
        {view === 'shared-match' && <SharedMatchView />}

        {/* God Mode — special admin access via ADMIN login (bypasses Clerk) */}
        {view === 'god-mode' && <GodModeView />}

        {/* Auth-gated views */}
        {view !== 'shared-match' && view !== 'god-mode' && (() => {
          // Show loading while Clerk is initialising
          if (authLoading) {
            return (
              <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm opacity-80">Laden...</p>
                </div>
              </div>
            );
          }

          // Not logged in → Clerk SignIn or SignUp component
          if (!isAuthenticated) {
            const isSignUpPage = window.location.pathname === '/sign-up';
            return (
              <div className="min-h-screen bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                  <div className="text-center mb-6">
                    <Trophy className="w-14 h-14 text-white mx-auto mb-3" />
                    <h1 className="text-2xl font-bold text-white">Korfbal Score App</h1>
                    <p className="text-white/70 text-sm mt-1">{isSignUpPage ? 'Maak een account aan' : 'Log in om verder te gaan'}</p>
                  </div>
                  {isSignUpPage ? (
                    <SignUp
                      appearance={{
                        elements: {
                          rootBox: 'w-full',
                          card: 'rounded-2xl shadow-2xl',
                          headerTitle: 'hidden',
                          headerSubtitle: 'hidden',
                        }
                      }}
                      signInUrl="/"
                      afterSignUpUrl="/"
                    />
                  ) : (
                    <SignIn
                      appearance={{
                        elements: {
                          rootBox: 'w-full',
                          card: 'rounded-2xl shadow-2xl',
                          headerTitle: 'hidden',
                          headerSubtitle: 'hidden',
                        }
                      }}
                      signUpUrl="/sign-up"
                    />
                  )}
                  {/* God Mode escape hatch — hidden, for admin only */}
                  <div className="mt-4 text-center">
                    <button
                      onClick={async () => {
                        const pw = window.prompt('God Mode wachtwoord:');
                        if (!pw) return;
                        try {
                          const result = await loginMutation({ team_name: 'ADMIN', password: pw });
                          if (result.isGodMode) { setShowGodMode(true); navigateTo('god-mode'); }
                        } catch { /* silent fail */ }
                      }}
                      className="text-xs text-white/20 hover:text-white/40 transition"
                    >
                      ···
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // Logged in — waiting for team data
          if (userTeams === undefined) {
            return (
              <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center text-gray-400">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm">Teams laden...</p>
                </div>
              </div>
            );
          }

          // No team yet → onboarding OR team picker requested "nieuw team"
          if (!currentTeamId || forceOnboarding) {
            if (userTeams.length === 0 || forceOnboarding) {
              return <OnboardingView />;
            }
            // 1 team → auto-selection useEffect will run immediately; show spinner to avoid flash
            if (userTeams.length === 1) {
              return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              );
            }
            // 2+ teams → picker
            return <TeamPickerView />;
          }

          // Normal authenticated app views
          return (
            <>
              {view === 'home' && <HomeView />}
              {view === 'manage-players' && <ManagePlayersView />}
              {view === 'setup-match' && <SetupMatchView />}
              {view === 'match' && <MatchView />}
              {view === 'match-summary' && <MatchSummaryView />}
              {view === 'statistics' && <StatisticsView />}
            </>
          );
        })()}
      </div>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
