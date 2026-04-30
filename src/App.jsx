import React, { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Trophy, Users, BarChart3, Plus, ArrowLeft, Download, Home, Search, Moon, Sun, Cog, ChevronDown, ChevronUp, RotateCcw, Share2, X, Link2, Crown, Check } from 'lucide-react';
import { useMutation, useQuery, useAction, useConvexAuth } from "convex/react";
import { useClerk, SignIn, SignUp } from "@clerk/clerk-react";
import { api } from "../convex/_generated/api";
import { SHOT_TYPES } from './constants/shotTypes';
import { generatePlayerId } from './utils/generatePlayerId';
import { exportMatchesCSV } from './utils/exportCSV';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { SettingsSheet } from './components/ui/SettingsSheet';
import { KorfbalLogo } from './components/ui/KorfbalLogo';
import { LandingPage } from './components/marketing/LandingPage';

// ─── AIAdviceCard ─────────────────────────────────────────────────────────────
// Isolated component with its own error boundary so a Convex query failure
// never crashes the rest of the app.
class AIAdviceErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          AI-advies tijdelijk niet beschikbaar. Probeer de pagina te herladen.
        </p>
      );
    }
    return this.props.children;
  }
}

function AIAdviceInner({ teamId, showFeedback }) {
  const aiAdvice = useQuery(api.aiQueries.getAdvice, { teamId });
  const generateAdviceAction = useAction(api.ai.generateTrainingAdvice);
  const [isGenerating, setIsGenerating] = useState(false);

  const LoadingLines = () => (
    <div className="animate-pulse space-y-3">
      {[80, 65, 75, 55].map((w, i) => (
        <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded" style={{ width: `${w}%` }} />
      ))}
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="stencil text-ink-500">AI Trainingsadvies</div>
        <button
          onClick={async () => {
            setIsGenerating(true);
            try {
              await generateAdviceAction({ teamId });
              showFeedback('Trainingsadvies gegenereerd!', 'success');
            } catch (e) {
              showFeedback(e.message || 'Fout bij genereren advies');
            } finally {
              setIsGenerating(false);
            }
          }}
          disabled={isGenerating}
          className="stencil text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg text-[10px] hover:bg-primary/15 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {isGenerating ? (
            <>
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Genereren…
            </>
          ) : aiAdvice ? '↻ Vernieuw' : '✦ Genereer advies'}
        </button>
      </div>

      {isGenerating && <LoadingLines />}

      {aiAdvice && !isGenerating && (
        <div>
          <p className="text-[13px] text-ink-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{aiAdvice.advice}</p>
          <p className="stencil text-ink-400 mt-3 pt-3 border-t border-black/[.05] dark:border-gray-700">
            {new Date(aiAdvice.generatedAt).toLocaleDateString('nl-NL')} · {aiAdvice.basedOnMatchCount} wedstrijden
          </p>
        </div>
      )}

      {!aiAdvice && !isGenerating && (
        <p className="text-[13px] text-ink-500 leading-relaxed">
          Klik op "Genereer advies" voor gepersonaliseerde trainingstips op basis van jullie statistieken.
        </p>
      )}
    </>
  );
}

function AIAdviceCard({ teamId, showFeedback }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4">
      <AIAdviceErrorBoundary>
        <AIAdviceInner teamId={teamId} showFeedback={showFeedback} />
      </AIAdviceErrorBoundary>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

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
          className="w-full p-3 border border-black/[.1] dark:border-gray-600 rounded-xl mb-4 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
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

// ─── SetupMatchView ───────────────────────────────────────────────────────────
// Top-level component (outside KorfbalApp) to prevent keyboard dismissal bug
// caused by component re-definition on every App render.
function SetupMatchView({
  currentTeamData, currentTeam,
  opponent, setOpponent,
  selectedPlayers, setSelectedPlayers,
  withAttempts, setWithAttempts,
  matchDate, setMatchDate,
  seasons, seasonId, setSeasonId,
  competition, setCompetition,
  navigateTo, handleLogout,
  setCurrentMatch, setMatchActionHistory, resetTimer, showFeedback
}) {
  const players = currentTeamData?.players || [];

  // Show message if no players available
  if (players.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-gray-900">
        <div className="px-4 pt-4 pb-2 flex items-center gap-3 border-b border-black/[.06] dark:border-gray-800">
          <button onClick={() => navigateTo('home')} className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-black/[.08] flex items-center justify-center" aria-label="Terug"><ArrowLeft className="w-4 h-4" /></button>
          <span className="font-bold text-[13px] text-ink-900 dark:text-white">Nieuwe wedstrijd</span>
        </div>
        <div className="p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Je hebt nog geen spelers toegevoegd.</p>
            <button onClick={() => navigateTo('manage-players')}
              className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-dark transition">
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
      players: allPlayers, score: 0, opponentScore: 0, opponentGoals: [], goals: [],
      withAttempts: withAttempts,
      ...(seasonId ? { seasonId, competition } : {})
    });
    setMatchActionHistory([]);
    resetTimer();
    setOpponent('');
    setSelectedPlayers([]);
    setWithAttempts(true);
    setMatchDate(new Date().toISOString().split('T')[0]);
    setSeasonId(null);
    setCompetition('veld');
    navigateTo('match');
    showFeedback('Wedstrijd gestart!', 'success');
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3.5 flex items-center justify-between border-b border-black/[.06] dark:border-gray-800 bg-[#FAFAF7] dark:bg-gray-900">
        <button onClick={() => navigateTo('home')} className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-black/[.08] flex items-center justify-center" aria-label="Terug">
          <ArrowLeft className="w-4 h-4 text-ink-900 dark:text-white" />
        </button>
        <span className="font-bold text-[13px] text-ink-900 dark:text-white">Nieuwe wedstrijd</span>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 space-y-3.5">
        {/* Headline */}
        <div>
          <h1 className="font-display font-black text-[28px] leading-tight tracking-tight text-ink-900 dark:text-white">
            Zet je<br />opstelling klaar.
          </h1>
          <p className="text-[13px] text-gray-400 mt-1">{currentTeam} · {new Date(matchDate).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        {/* Tegenstander + datum */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4 space-y-3">
          <div>
            <div className="stencil text-[10px] text-gray-400 mb-2">Tegenstander</div>
            <input type="text" value={opponent} onChange={(e) => setOpponent(e.target.value)}
              className="w-full px-3 py-2.5 border border-black/[.1] dark:border-gray-600 rounded-xl focus:border-primary focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-base font-semibold"
              placeholder="Naam tegenstander" />
          </div>
          <div>
            <div className="stencil text-[10px] text-gray-400 mb-2">Datum</div>
            <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-black/[.1] dark:border-gray-600 rounded-xl focus:border-primary focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-sm" />
          </div>
        </div>

        {/* Pogingen bijhouden */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4">
          <button onClick={() => setWithAttempts(!withAttempts)} className="flex items-center justify-between w-full">
            <div>
              <p className="text-sm font-semibold text-ink-900 dark:text-gray-100 text-left">Pogingen bijhouden</p>
              <p className="text-xs text-gray-400 text-left mt-0.5">Schot-pogingen tellen voor percentage</p>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${withAttempts ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-600'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${withAttempts ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </button>
        </div>

        {/* Seizoen picker */}
        {seasons && seasons.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4 space-y-3">
            <div>
              <div className="stencil text-[10px] text-gray-400 mb-2">Seizoen</div>
              <select
                value={seasonId || ''}
                onChange={e => setSeasonId(e.target.value || null)}
                className="w-full px-3 py-2.5 border border-black/[.1] dark:border-gray-600 rounded-xl focus:border-primary focus:outline-none dark:bg-gray-700 dark:text-gray-100 text-sm font-medium"
              >
                <option value="">Geen seizoen</option>
                {seasons.map(s => (
                  <option key={s._id} value={s._id}>{s.name}{s.isActive ? ' (actief)' : ''}</option>
                ))}
              </select>
            </div>
            {seasonId && (
              <div>
                <div className="stencil text-[10px] text-gray-400 mb-2">Competitie</div>
                <div className="flex gap-2">
                  {['veld', 'zaal'].map(type => (
                    <button
                      key={type}
                      onClick={() => setCompetition(type)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                        competition === type
                          ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Spelerselectie */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="stencil text-ink-500">Kies 8 spelers</div>
            <div className={`font-display font-black text-[16px] tabular ${selectedPlayers.length === 8 ? 'text-green-600' : 'text-primary'}`}>
              {selectedPlayers.length}<span className="text-ink-400 font-light">/8</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {players.map(player => {
              const isSelected = !!selectedPlayers.find(p => p.id === player.id);
              const isAanval = player.position === 'aanval';
              const posLabel = isAanval ? 'A' : 'V';
              return (
                <button key={player.id} onClick={() => togglePlayer(player)}
                  className={`p-2.5 rounded-xl text-left transition flex items-center gap-2 ${
                    isSelected
                      ? isAanval
                        ? 'bg-red-50 border border-primary text-primary dark:bg-red-900/20 dark:border-red-500 dark:text-red-400'
                        : 'bg-ink-900 border border-ink-900 text-white dark:bg-gray-700 dark:border-gray-600'
                      : 'bg-canvas border border-black/[.06] text-ink-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                  }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-display font-black text-[9px] flex-shrink-0 ${
                    isSelected
                      ? isAanval ? 'bg-primary/20 text-primary' : 'bg-white/20 text-white'
                      : 'bg-black/[.06] text-ink-500 dark:bg-gray-600 dark:text-gray-300'
                  }`}>{posLabel}</span>
                  <span className="font-semibold text-[12px] truncate">{player.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky bottom CTA */}
      <div className="px-4 py-4 bg-white dark:bg-gray-900 border-t border-black/[.06] dark:border-gray-800">
        <button onClick={startMatch} disabled={!opponent || selectedPlayers.length !== 8}
          className="w-full bg-primary text-white py-3.5 rounded-2xl font-bold text-[15px] hover:bg-primary-dark active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          Start wedstrijd →
        </button>
      </div>
    </div>
  );
}

export default function KorfbalApp() {
  const [view, setView] = useState('login');
  const [currentTeam, setCurrentTeam] = useState(null);
  const [currentTeamId, setCurrentTeamId] = useState(null);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [matchActionHistory, setMatchActionHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showGodMode, setShowGodMode] = useState(false);
  const [godModePassword, setGodModePassword] = useState('');
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
  const [forcePicker, setForcePicker] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [authPagePath, setAuthPagePath] = useState(window.location.pathname);
  // SetupMatchView state — lifted here to survive Convex re-renders
  const [setupOpponent, setSetupOpponent] = useState('');
  const [setupSelectedPlayers, setSetupSelectedPlayers] = useState([]);
  const [setupWithAttempts, setSetupWithAttempts] = useState(true);
  const [setupMatchDate, setSetupMatchDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [setupSeasonId, setSetupSeasonId] = useState(null);   // null = geen seizoen
  const [setupCompetition, setSetupCompetition] = useState('veld');
  // Timer state — lifted here so MatchView re-renders don't reset it
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerIntervalRef = useRef(null);
  const feedbackRef = useRef(null);

  // Timer interval — managed at top level so MatchView re-renders don't reset it
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [timerRunning]);

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

  const resetTimer = useCallback(() => {
    setTimerSeconds(0);
    setTimerRunning(true);
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
  const allTeams = useQuery(api.teams.getAllTeams, showGodMode && godModePassword ? { godModePassword } : "skip");
  const teams = showGodMode ? (allTeams || []) : [];

  const teamMatches = useQuery(
    api.matches.getTeamMatches,
    currentTeamId && !showGodMode ? { teamId: currentTeamId } : "skip"
  );
  const allMatches = useQuery(api.matches.getAllMatches, showGodMode && godModePassword ? { godModePassword } : "skip");
  const matches = showGodMode ? (allMatches || []) : (teamMatches || []);

  // Shared match query
  const sharedMatchData = useQuery(
    api.matches.getShareableMatch,
    sharedMatchId ? { matchId: sharedMatchId } : "skip"
  );

  const currentUserIsAdmin = userTeams?.find(t => t.teamId === currentTeamId)?.role === 'admin';

  // Current team query - for getting players
  const currentTeamData = useQuery(
    api.teams.getTeam,
    currentTeamId && !showGodMode ? { teamId: currentTeamId } : "skip"
  );

  // Seasons query
  const seasons = useQuery(
    api.seasons.getSeasons,
    currentTeamId && !showGodMode ? { teamId: currentTeamId } : "skip"
  );

  // Subscription + match count for free tier enforcement
  const subscription = useQuery(
    api.subscriptions.getSubscription,
    currentTeamId && !showGodMode ? { teamId: currentTeamId } : "skip"
  );
  const matchCountData = useQuery(
    api.subscriptions.getMatchCount,
    currentTeamId && !showGodMode ? { teamId: currentTeamId } : "skip"
  );

  // Debounce currentMatch to reduce localStorage writes
  const debouncedMatch = useDebounce(currentMatch, 500);

  // Sync color theme from team data — each team has its own theme stored in Convex
  useEffect(() => {
    if (currentTeamData?.color_theme) {
      setColorTheme(currentTeamData.color_theme);
    }
  }, [currentTeamData?.color_theme]);

  // Auto-select active season for new matches
  useEffect(() => {
    if (seasons && seasons.length > 0) {
      const active = seasons.find(s => s.isActive);
      if (active) setSetupSeasonId(active._id);
    }
  }, [seasons]);

  // AI training advice — rendered via isolated AIAdviceCard component below

  // Views that require authentication
  const authRequiredViews = ['home', 'manage-players', 'setup-match', 'match', 'match-summary', 'statistics'];

  // Keep authPagePath in sync with pathname changes (for landing/login routing)
  useEffect(() => {
    const update = () => setAuthPagePath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

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
    if (debouncedMatch && currentTeamId && !debouncedMatch._id) {
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
    if (forcePicker || forceOnboarding) return; // user explicitly navigating

    if (userTeams.length === 1) {
      // Only one team → auto-select
      if (userTeams[0].teamId === 'god-mode') {
        setShowGodMode(true);
        navigateTo('god-mode');
      } else {
        setCurrentTeam(userTeams[0].teamName);
        setCurrentTeamId(userTeams[0].teamId);
        if (view === 'login' || view === 'onboarding') navigateTo('home');
      }
    }
    // 0 teams → OnboardingView (handled in routing)
    // 2+ teams → TeamPickerView (handled in routing)
  }, [isAuthenticated, userTeams, currentTeamId, forcePicker, forceOnboarding]);

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
  const createSeasonMutation = useMutation(api.seasons.createSeason);
  const closeSeasonMutation = useMutation(api.seasons.closeSeason);

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

      const normalizedSubstitutions = (match.substitutions || []).map(s => ({
        outPlayerId:   s.outPlayerId,
        outPlayerName: s.outPlayerName ?? 'Onbekend',
        inPlayerId:    s.inPlayerId,
        inPlayerName:  s.inPlayerName ?? 'Onbekend',
        timestamp:     s.timestamp ?? new Date().toISOString(),
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
        ...(normalizedSubstitutions.length > 0 ? { substitutions: normalizedSubstitutions } : {}),
        finished: true,
        shareable: false,
        ...(match.seasonId ? { seasonId: match.seasonId, competition: match.competition } : {}),
      };
      const matchId = await createMatchMutation(payload);
      // Update currentMatch with database ID to prevent duplicate creation
      setCurrentMatch(prev => prev ? { ...prev, _id: matchId } : prev);
      // Clear localStorage after successful save
      localStorage.removeItem('korfbal_active_match');
      showFeedback('Wedstrijd opgeslagen', 'success');
      return true;
    } catch (e) {
      console.error('saveMatch fout:', e);
      if (e.message?.includes('FREE_LIMIT_REACHED')) {
        setShowUpgradeModal(true);
        return false;
      }
      showFeedback(`Fout bij opslaan: ${e.message || 'Onbekende fout'}`, 'error');
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
    const [mode, setMode] = useState(null); // null | 'new' | 'claim'
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
      <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-black/[.04]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-[7px] flex items-center justify-center">
              <span className="font-display font-black text-[13px] text-white leading-none">K</span>
            </div>
            <span className="font-display font-black text-[14px] tracking-tight text-ink-900">Korfbal Score</span>
          </div>
          <button onClick={() => signOut()} className="text-[12px] font-semibold text-gray-400 hover:text-gray-600 transition">
            Uitloggen
          </button>
        </div>

        {mode === null ? (
          /* Landing: kies modus */
          <div className="flex-1 flex flex-col justify-center px-7 text-center relative overflow-hidden">
            {/* Watermark K */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none select-none">
              <span className="font-display font-black text-[280px] leading-none text-primary">K</span>
            </div>
            <div className="relative">
              <div className="stencil text-[10px] text-primary mb-2.5">Welkom</div>
              <h1 className="font-display font-black text-[32px] leading-[0.95] tracking-[-0.03em] text-ink-900 mb-3.5">
                Het veld<br/>is nog leeg.
              </h1>
              <p className="text-[14px] leading-relaxed text-gray-500 mb-7 max-w-[280px] mx-auto">
                Maak je eerste team aan, of koppel een bestaand team als iemand je heeft uitgenodigd.
              </p>
              <div className="flex flex-col gap-2.5 max-w-[280px] mx-auto">
                <button
                  onClick={() => setMode('new')}
                  className="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <Plus className="w-4 h-4" /> Eerste team aanmaken
                </button>
                <button
                  onClick={() => setMode('claim')}
                  className="w-full bg-white text-ink-900 border border-black/[.1] py-3.5 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <Link2 className="w-4 h-4" /> Bestaand team koppelen
                </button>
              </div>
              {userTeams && userTeams.length > 0 && (
                <button
                  onClick={() => { setForceOnboarding(false); if (currentTeamId) navigateTo('home'); else setForcePicker(true); }}
                  className="mt-5 text-[13px] font-semibold text-primary"
                >
                  ← Terug naar mijn teams
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Formulier */
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <button
              onClick={() => { setMode(null); setTeamName(''); setPassword(''); }}
              className="flex items-center gap-1.5 mt-4 mb-6 text-[13px] font-semibold text-gray-500 hover:text-ink-900 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Terug
            </button>
            <div className="stencil text-[10px] text-primary mb-2">
              {mode === 'new' ? 'Nieuw team' : 'Bestaand team koppelen'}
            </div>
            <h1 className="font-display font-black text-[28px] leading-tight tracking-tight text-ink-900 mb-1.5">
              {mode === 'new' ? 'Geef je team\neen naam.' : 'Koppel je\nbestaand team.'}
            </h1>
            <p className="text-[13px] text-gray-400 mb-6 leading-relaxed">
              {mode === 'new'
                ? 'Je kunt de naam en kleur later altijd wijzigen.'
                : 'Vul de teamnaam en het oude wachtwoord in.'}
            </p>
            <div className="space-y-3">
              <div>
                <div className="stencil text-[9px] text-gray-400 mb-1.5">Teamnaam</div>
                <input
                  type="text"
                  placeholder={mode === 'new' ? 'Bijv. Klimop B1' : 'Naam van je huidige team'}
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && mode === 'new' && handleCreateTeam()}
                  className="w-full px-3.5 py-3 border border-black/[.1] rounded-xl font-semibold text-[15px] bg-white focus:outline-none focus:border-primary transition"
                  autoFocus
                />
              </div>
              {mode === 'claim' && (
                <div>
                  <div className="stencil text-[9px] text-gray-400 mb-1.5">Oud wachtwoord</div>
                  <input
                    type="password"
                    placeholder="Wachtwoord van voor de update"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleClaimTeam()}
                    className="w-full px-3.5 py-3 border border-black/[.1] rounded-xl font-semibold text-[15px] bg-white focus:outline-none focus:border-primary transition"
                  />
                </div>
              )}
              <button
                onClick={mode === 'new' ? handleCreateTeam : handleClaimTeam}
                disabled={busy}
                className="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-[14px] hover:bg-primary-dark active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
              >
                {busy ? 'Bezig...' : (mode === 'new' ? 'Team aanmaken →' : 'Team koppelen →')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── TeamPickerView: choose a team when user belongs to multiple ───
  const TeamPickerView = () => (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-black/[.06]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-[7px] flex items-center justify-center">
            <span className="font-display font-black text-[13px] text-white leading-none">K</span>
          </div>
          <span className="font-display font-black text-[14px] tracking-tight text-ink-900">Korfbal Score</span>
        </div>
        {currentTeamId && (
          <button
            onClick={() => { setForcePicker(false); navigateTo('home'); }}
            className="text-[12px] font-semibold text-gray-400 hover:text-ink-900 transition"
          >
            ← Sluiten
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-8">
        <div className="stencil text-[10px] text-gray-400 mb-3">Schakelen tussen</div>
        <h1 className="font-display font-black text-[26px] tracking-[-0.025em] text-ink-900 mb-5">Mijn teams</h1>

        <div className="space-y-2 mb-4">
          {(userTeams || []).map((t) => {
            const isActive = t.teamId === currentTeamId;
            return (
              <button
                key={t.teamId}
                onClick={() => {
                  if (t.teamId === 'god-mode') {
                    setShowGodMode(true);
                    setForcePicker(false);
                    navigateTo('god-mode');
                  } else {
                    setCurrentTeam(t.teamName);
                    setCurrentTeamId(t.teamId);
                    setForcePicker(false);
                    navigateTo('home');
                  }
                }}
                className={`w-full text-left px-4 py-3.5 rounded-2xl border flex items-center gap-3.5 transition active:scale-[0.98] ${
                  isActive
                    ? 'bg-ink-900 border-ink-900 text-white'
                    : 'bg-white border-black/[.08] text-ink-900'
                }`}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-black text-[18px] text-white flex-shrink-0"
                  style={{ background: t.colorTheme === 'blue' ? '#2563EB' : t.colorTheme === 'green' ? '#16A34A' : t.colorTheme === 'orange' ? '#EA580C' : t.colorTheme === 'purple' ? '#7C3AED' : '#DC2626' }}
                >
                  {t.teamName?.[0] || 'T'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[15px] truncate">{t.teamName}</span>
                    {t.role === 'admin' && <Crown className="w-3 h-3 flex-shrink-0" style={{ color: '#D97706' }} />}
                  </div>
                  <div className={`stencil text-[9px] mt-0.5 ${isActive ? 'text-white/55' : 'text-gray-400'}`}>
                    {t.role === 'admin' ? 'Beheerder' : 'Lid'}
                  </div>
                </div>
                {isActive && <Check className="w-5 h-5 flex-shrink-0 text-white" strokeWidth={3} />}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => { setForceOnboarding(true); setForcePicker(false); }}
          className="w-full py-3.5 bg-[#FAFAF7] border border-dashed border-black/15 rounded-2xl font-semibold text-[13px] text-gray-500 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nieuw team aanmaken
        </button>

        <div className="mt-5 text-center space-y-2">
          <button onClick={() => signOut()} className="text-[12px] text-gray-400 hover:text-gray-600 transition">
            Uitloggen
          </button>
          {/* God Mode — verborgen voor admin */}
          <button
            onClick={async () => {
              const pw = window.prompt('God Mode wachtwoord:');
              if (!pw) return;
              try {
                const result = await loginMutation({ team_name: 'ADMIN', password: pw });
                if (result.isGodMode) { setGodModePassword(pw); setShowGodMode(true); navigateTo('god-mode'); }
              } catch { /* silent fail */ }
            }}
            className="block mx-auto text-[11px] text-gray-200 hover:text-gray-400 transition"
          >
            ···
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
            await renameTeamMutation({ teamId: team._id, newName: newName.trim(), godModePassword });
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
        placeholder: 'Nieuw wachtwoord (min. 8 tekens)',
        onSubmit: async (newPassword) => {
          try {
            await resetPasswordMutation({ teamId: team._id, newPassword, godModePassword });
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
              godModePassword,
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
            await deleteTeamMutation({ teamId: team._id, godModePassword });
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
              setGodModePassword('');
              navigateTo('login');
            }} className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 px-3 py-1" aria-label="God mode sluiten">Sluiten</button>
          </div>

          {allTeams === undefined ? (
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
                          const result = await cleanDuplicateTeamsMutation({ godModePassword });
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
                  className="w-full p-3 border border-black/[.1] dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
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
    const [showNewSeasonForm, setShowNewSeasonForm] = useState(false);
    const [newSeasonName, setNewSeasonName] = useState('');

    const activeSeason = (seasons || []).find(s => s.isActive) || null;

    const handleCreateSeason = async () => {
      if (!newSeasonName.trim() || newSeasonName.trim().length < 2) {
        showFeedback('Vul een seizoensnaam in (bijv. "2025-2026")', 'error');
        return;
      }
      try {
        await createSeasonMutation({ teamId: currentTeamId, name: newSeasonName.trim() });
        showFeedback(`Seizoen "${newSeasonName.trim()}" gestart!`, 'success');
        setNewSeasonName('');
        setShowNewSeasonForm(false);
      } catch (e) {
        showFeedback('Fout bij aanmaken seizoen', 'error');
      }
    };

    const handleCloseSeason = () => {
      if (!activeSeason) return;
      showConfirm({
        title: 'Seizoen afsluiten',
        message: `Seizoen "${activeSeason.name}" afsluiten? Je kunt het daarna niet meer als actief seizoen gebruiken.`,
        confirmLabel: 'Afsluiten',
        variant: 'danger',
        onConfirm: async () => {
          try {
            await closeSeasonMutation({ seasonId: activeSeason._id });
            showFeedback(`Seizoen "${activeSeason.name}" afgesloten`, 'success');
          } catch (e) {
            showFeedback('Fout bij afsluiten seizoen', 'error');
          }
        }
      });
    };

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

    const recentMatches = teamMatches
      .filter(m => m.finished)
      .sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0))
      .slice(0, 3);

    // Quick stats for the 3-column grid
    const finishedMatches = teamMatches.filter(m => m.finished);
    const homeWins = finishedMatches.filter(m => m.score > m.opponent_score).length;
    const homeGoalsFor = finishedMatches.reduce((s, m) => s + (m.score || 0), 0);
    const homeGoalsAgainst = finishedMatches.reduce((s, m) => s + (m.opponent_score || 0), 0);
    const homeGoalDiff = homeGoalsFor - homeGoalsAgainst;

    return (
      <div className="min-h-screen bg-canvas dark:bg-gray-900">
        {/* Header */}
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <div>
            <div className="text-[12px] font-medium text-ink-500 dark:text-gray-500 mb-0.5">
              {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <h1 className="font-display font-black text-[22px] tracking-[-0.025em] text-ink-900 dark:text-white leading-tight">
              {currentTeam} <span className="text-primary">.</span>
            </h1>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-black/[.08] dark:border-gray-700 flex items-center justify-center"
            aria-label="Instellingen openen"
          >
            <Cog className="w-[18px] h-[18px] text-ink-500 dark:text-gray-300" />
          </button>
        </div>

        <div className="px-4 pb-24 space-y-3 mt-2">

          {/* Saved match banner */}
          {savedMatchInfo && (
            <div className="bg-ink-900 rounded-[20px] p-5 relative overflow-hidden">
              <div className="field-pattern absolute inset-0 opacity-50" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="stencil text-amber-400 mb-1">Wedstrijd bezig!</div>
                    <div className="font-bold text-white text-sm">{currentTeam} vs {savedMatchInfo.opponent}</div>
                  </div>
                  <div className="score-number text-[28px] text-white">{savedMatchInfo.score}–{savedMatchInfo.opponentScore}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleContinueSavedMatch}
                    className="flex-1 bg-primary text-white py-3 rounded-xl text-sm font-bold active:scale-95 transition"
                  >
                    ▶ Verder gaan
                  </button>
                  <button
                    onClick={handleDiscardSavedMatch}
                    className="bg-white/10 text-white/70 px-4 py-3 rounded-xl text-sm font-semibold"
                    aria-label="Opgeslagen wedstrijd verwijderen"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Free tier banner */}
          {matchCountData && subscription?.status === 'free' && matchCountData.count >= 15 && (
            <div className="bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-ink-900 dark:text-white text-sm">
                  {matchCountData.count}/{matchCountData.limit} wedstrijden gebruikt
                </p>
                <p className="stencil text-amber-600 dark:text-amber-400 mt-1">
                  {matchCountData.limit - matchCountData.count} resterend · upgrade voor onbeperkt
                </p>
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-3 py-2 bg-primary text-white rounded-xl text-xs font-bold flex-shrink-0"
              >
                Upgraden
              </button>
            </div>
          )}

          {/* Nieuwe wedstrijd — hero card */}
          <button
            onClick={() => navigateTo('setup-match')}
            className="w-full bg-ink-900 dark:bg-gray-800 rounded-[20px] p-5 text-left relative overflow-hidden active:scale-[0.98] transition-transform"
          >
            <div className="field-pattern absolute inset-0 opacity-50" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="stencil text-white/55">Volgende wedstrijd</div>
                {activeSeason && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/20 border border-primary/30">
                    <span className="stencil text-[9px] text-red-300">{activeSeason.name}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-xl overflow-hidden mx-auto mb-1.5">
                    <KorfbalLogo size={40} variant="red" />
                  </div>
                  <div className="font-bold text-white text-[12px] truncate">{currentTeam}</div>
                  {finishedMatches.length > 0 && (
                    <div className="stencil text-[9px] text-white/45 mt-1">
                      {finishedMatches.slice(-5).map(m => m.score > m.opponent_score ? 'W' : m.score < m.opponent_score ? 'V' : 'G').join('·')}
                    </div>
                  )}
                </div>
                <div className="text-[10px] font-semibold text-white/35 tracking-widest">VS</div>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-xl bg-white/[.06] border border-white/10 text-white flex items-center justify-center font-display font-black text-lg mx-auto mb-1.5">
                    ?
                  </div>
                  <div className="font-bold text-white text-[12px]">Tegenstander</div>
                  <div className="stencil text-[9px] text-white/45 mt-1">Nog in te stellen</div>
                </div>
              </div>
              <div className="w-full bg-primary text-white py-3 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Start wedstrijd
              </div>
            </div>
          </button>

          {/* 3-kolom stat grid */}
          {finishedMatches.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: `${homeWins}`, sub: `/${finishedMatches.length}`, l: 'Gewonnen' },
                { v: String(homeGoalsFor), l: 'Doelpunten' },
                { v: (homeGoalDiff >= 0 ? '+' : '') + homeGoalDiff, l: 'Doelsaldo' },
              ].map(s => (
                <div key={s.l} className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-3.5">
                  <div className="score-number text-[26px] text-ink-900 dark:text-white leading-none">
                    {s.v}<span className="font-sans font-medium text-[13px] text-ink-400">{s.sub || ''}</span>
                  </div>
                  <div className="stencil text-ink-500 mt-1.5">{s.l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Snelle navigatie */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => navigateTo('manage-players')}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-left border border-black/[.06] dark:border-gray-700 active:scale-[0.98] transition-transform"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-2.5">
                <Users className="w-[18px] h-[18px] text-primary" />
              </div>
              <div className="font-bold text-sm text-ink-900 dark:text-white">Spelers</div>
              <div className="stencil text-ink-500 mt-1">Beheren</div>
            </button>
            <button
              onClick={() => navigateTo('statistics')}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 text-left border border-black/[.06] dark:border-gray-700 active:scale-[0.98] transition-transform"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-2.5">
                <BarChart3 className="w-[18px] h-[18px] text-primary" />
              </div>
              <div className="font-bold text-sm text-ink-900 dark:text-white">Statistieken</div>
              <div className="stencil text-ink-500 mt-1">{teamMatches.length} wedstrijden</div>
            </button>
          </div>

          {/* AI Coach card */}
          <AIAdviceCard teamId={currentTeamId} showFeedback={showFeedback} />

          {/* Recente wedstrijden */}
          {recentMatches.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between mb-2.5 px-1">
                <div className="stencil text-ink-500">Recente wedstrijden</div>
                <button
                  onClick={() => navigateTo('statistics')}
                  className="text-[11px] font-semibold text-primary"
                >
                  Alles →
                </button>
              </div>
              <div className="space-y-1.5">
                {recentMatches.map(m => {
                  const res = m.score > m.opponent_score ? 'W' : m.score < m.opponent_score ? 'V' : 'G';
                  const resColor = res === 'W'
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : res === 'V'
                    ? 'bg-red-50 text-primary dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-gray-100 text-ink-500 dark:bg-gray-700 dark:text-gray-400';
                  return (
                    <div key={m._id} className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 px-4 py-3.5 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-[13px] flex-shrink-0 ${resColor}`}>{res}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[13px] text-ink-900 dark:text-white">vs {m.opponent}</div>
                        <div className="stencil text-ink-400 mt-0.5">
                          {m._creationTime ? new Date(m._creationTime).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : ''}
                        </div>
                      </div>
                      <div className="score-number text-[20px] text-ink-900 dark:text-white">{m.score}–{m.opponent_score}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seizoenbeheer */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-sm text-ink-900 dark:text-white">Seizoen</div>
              {activeSeason ? (
                <span className="stencil bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">Actief</span>
              ) : (
                <span className="stencil bg-gray-100 text-ink-500 dark:bg-gray-700 dark:text-gray-400 px-2 py-1 rounded-full">Geen seizoen</span>
              )}
            </div>
            {activeSeason ? (
              <div className="space-y-2.5">
                <p className="text-sm font-semibold text-ink-700 dark:text-gray-300">{activeSeason.name}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowNewSeasonForm(true); setNewSeasonName(''); }}
                    className="flex-1 bg-primary text-white py-2 px-3 rounded-xl text-xs font-bold hover:bg-primary-dark transition"
                  >
                    Nieuw seizoen
                  </button>
                  <button
                    onClick={handleCloseSeason}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-ink-500 dark:text-gray-300 py-2 px-3 rounded-xl text-xs font-bold transition"
                  >
                    Afsluiten
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-ink-500 dark:text-gray-400 mb-2.5">Start een seizoen om wedstrijden en statistieken bij te houden.</p>
                <button
                  onClick={() => { setShowNewSeasonForm(true); setNewSeasonName(''); }}
                  className="w-full bg-primary text-white py-2 px-3 rounded-xl text-xs font-bold hover:bg-primary-dark transition"
                >
                  Nieuw seizoen starten
                </button>
              </div>
            )}
            {showNewSeasonForm && (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={newSeasonName}
                  onChange={e => setNewSeasonName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateSeason(); if (e.key === 'Escape') setShowNewSeasonForm(false); }}
                  placeholder='bijv. "2025-2026"'
                  className="w-full border border-black/[.1] dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm font-semibold dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateSeason}
                    className="flex-1 bg-primary text-white py-2 rounded-xl text-xs font-bold hover:bg-primary-dark transition"
                  >
                    Starten
                  </button>
                  <button
                    onClick={() => setShowNewSeasonForm(false)}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-ink-500 dark:text-gray-300 py-2 rounded-xl text-xs font-bold transition"
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            )}
          </div>
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
        <div className="min-h-screen bg-[#FAFAF7] dark:bg-gray-900">
          <div className="px-4 py-3.5 flex items-center justify-between border-b border-black/[.06] dark:border-gray-800 bg-[#FAFAF7] dark:bg-gray-900 sticky top-0 z-10">
            <button onClick={handleBack} className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-black/[.08] flex items-center justify-center" aria-label="Terug naar home">
              <ArrowLeft className="w-4 h-4 text-ink-900 dark:text-white" />
            </button>
            <div className="font-bold text-[13px] text-ink-900 dark:text-white">Spelers beheren</div>
            <button onClick={handleLogout} className="stencil text-[10px] text-gray-400 hover:text-primary transition">Uitloggen</button>
          </div>
          <div className="max-w-2xl mx-auto p-4 pb-24">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4 text-center">
              <p className="text-[13px] text-ink-500">Laden...</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-gray-900">
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-black/[.06] dark:border-gray-800 bg-[#FAFAF7] dark:bg-gray-900 sticky top-0 z-10">
          <button onClick={handleBack} className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-black/[.08] flex items-center justify-center" aria-label="Terug naar home">
            <ArrowLeft className="w-4 h-4 text-ink-900 dark:text-white" />
          </button>
          <div className="font-bold text-[13px] text-ink-900 dark:text-white">Spelers beheren</div>
          <button onClick={handleLogout} className="stencil text-[10px] text-gray-400 hover:text-primary transition">Uitloggen</button>
        </div>
        <div className="max-w-2xl mx-auto p-4 pb-24">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4 mb-4">
            <div className="flex gap-2 mb-4">
              <input type="text" placeholder="Naam nieuwe speler" value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                className="flex-1 px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-black/[.08] dark:border-gray-600 rounded-xl focus:border-primary focus:outline-none dark:text-gray-100 text-[14px]" />
              <button onClick={addPlayer} className="bg-primary text-white px-4 py-2.5 rounded-xl hover:bg-primary-dark transition" aria-label="Speler toevoegen">
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
                      className={`flex justify-between items-center p-3 rounded-xl transition-all duration-500 border ${
                        isJustAdded
                          ? 'bg-primary/5 border-primary/30 dark:border-primary/20'
                          : 'bg-white dark:bg-gray-800 border-black/[.06] dark:border-gray-700'
                      }`}
                    >
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveEditPlayer(player.id)}
                            className="flex-1 px-3 py-1.5 border border-primary rounded-xl focus:outline-none text-[14px] mr-2 dark:bg-gray-700 dark:text-white"
                            autoFocus
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => saveEditPlayer(player.id)}
                              className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-primary-dark transition"
                            >
                              ✓
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                            >
                              ✕
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-[14px] text-ink-900 dark:text-white flex-1">{player.name}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEditPlayer(player)}
                              className="text-gray-400 hover:text-primary font-medium text-sm min-h-[44px] min-w-[44px] px-2 transition"
                            >
                              Bewerk
                            </button>
                            <button
                              onClick={() => removePlayer(player.id)}
                              className="text-gray-400 hover:text-primary font-medium text-sm min-h-[44px] min-w-[44px] px-2 transition"
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 px-4 py-3">
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Spelers worden automatisch opgeslagen wanneer je ze toevoegt of verwijdert.</p>
          </div>
        </div>
      </div>
    );
  };
  // SetupMatchView is defined as a top-level component above KorfbalApp
  // It receives all needed state as props (keyboard bug fix)

  const MatchView = () => {
    const [showGoalModal, setShowGoalModal] = useState(null);
    const [showAttemptModal, setShowAttemptModal] = useState(null);
    const [showOpponentModal, setShowOpponentModal] = useState(false);
    const [showOpponentPlayerModal, setShowOpponentPlayerModal] = useState(null);
    const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
    const actionHistory = matchActionHistory;
    const setActionHistory = setMatchActionHistory;
    const [scoreAnimKey, setScoreAnimKey] = useState(0);
    const [expandedPlayers, setExpandedPlayers] = useState(new Set());

    // ── Timer state is lifted to KorfbalApp to survive re-renders ──────────
    const formatTimer = (s) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };
    // ────────────────────────────────────────────────────────────────────────

    const togglePlayerExpand = (playerId) => {
      setExpandedPlayers(prev => {
        const next = new Set(prev);
        if (next.has(playerId)) { next.delete(playerId); } else { next.add(playerId); }
        return next;
      });
    };

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
      setActionHistory(prev => [...prev, { type: 'goal', match: currentMatch }]);
      setCurrentMatch(prevMatch => {
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
      setActionHistory(prev => [...prev, { type: 'attempt', match: currentMatch }]);
      setCurrentMatch(prevMatch => {
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
      setActionHistory(prev => [...prev, { type: 'opponent_goal', match: currentMatch }]);
      setCurrentMatch(prevMatch => {
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

    const registerSubstitution = (outPlayerId, inPlayerId) => {
      setActionHistory(prev => [...prev, { type: 'substitution', match: currentMatch }]);
      setCurrentMatch(prevMatch => {
        const outPlayer = prevMatch.players.find(p => p.id === outPlayerId);
        const inPlayer = prevMatch.players.find(p => p.id === inPlayerId);
        if (!outPlayer || !inPlayer) return prevMatch;
        const updatedPlayers = prevMatch.players.map(p => {
          if (p.id === outPlayerId) return { ...p, isStarter: false };
          if (p.id === inPlayerId) return { ...p, isStarter: true };
          return p;
        });
        const newSubstitution = {
          outPlayerId,
          outPlayerName: outPlayer.name,
          inPlayerId,
          inPlayerName: inPlayer.name,
          timestamp: new Date().toISOString(),
        };
        showFeedback(`Wissel: ${inPlayer.name} vervangt ${outPlayer.name}`, 'success');
        return {
          ...prevMatch,
          players: updatedPlayers,
          substitutions: [...(prevMatch.substitutions || []), newSubstitution],
        };
      });
      setShowSubstitutionModal(false);
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

    const isModalOpen = showGoalModal || showAttemptModal || showOpponentModal || showOpponentPlayerModal || showSubstitutionModal;

    const PlayerRow = ({ player }) => {
      const totalGoals = SHOT_TYPES.reduce((sum, type) => sum + getStat(player, type.id).goals, 0);
      const totalAttempts = SHOT_TYPES.reduce((sum, type) => sum + getStat(player, type.id).attempts, 0);
      const isExpanded = expandedPlayers.has(player.id);
      const hasStats = totalAttempts > 0;

      return (
        <div className="border-b border-gray-200 dark:border-gray-600 py-2 last:border-0">
          <div className="flex justify-between items-center gap-2">
            <button
              onClick={() => togglePlayerExpand(player.id)}
              className="flex items-center gap-1 flex-1 min-w-0 text-left"
              aria-label={isExpanded ? 'Statistieken verbergen' : 'Statistieken tonen'}
            >
              <span className="font-semibold text-gray-800 dark:text-gray-100 truncate">{player.name}</span>
              <span className="text-xs text-gray-500 shrink-0">
                {totalGoals > 0 ? <span className="font-semibold text-green-600">{totalGoals}</span> : '0'}
                {totalAttempts > 0 && <span className="text-gray-400">/{totalAttempts}</span>}
              </span>
              {hasStats && (isExpanded
                ? <ChevronUp className="w-3 h-3 text-gray-400 shrink-0" />
                : <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
              )}
            </button>
            <div className="flex space-x-2 shrink-0">
              <button onClick={() => setShowGoalModal(player)} disabled={isModalOpen}
                className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
                Goal
              </button>
              {currentMatch?.withAttempts !== false && (
                <button onClick={() => setShowAttemptModal(player)} disabled={isModalOpen}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  Poging
                </button>
              )}
            </div>
          </div>
          {isExpanded && hasStats && currentMatch?.withAttempts !== false && (
            <div className="flex flex-wrap gap-1 text-xs mt-1 pl-1">
              {SHOT_TYPES.map(type => {
                const stat = getStat(player, type.id);
                if (stat.attempts === 0) return null;
                return (
                  <span key={type.id} className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                    {type.short}: {stat.goals}/{stat.attempts}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      );
    };

    const [posFilter, setPosFilter] = useState('alle');
    const starters = currentMatch.players.filter(p => p.isStarter);
    const bench = currentMatch.players.filter(p => !p.isStarter);
    const visibleStarters = posFilter === 'alle' ? starters
      : starters.filter(p => posFilter === 'aanval' ? p.position === 'aanval' : p.position === 'verdediging');

    const PlayerCard = ({ player }) => {
      const totalGoals = SHOT_TYPES.reduce((sum, type) => sum + getStat(player, type.id).goals, 0);
      const totalAttempts = SHOT_TYPES.reduce((sum, type) => sum + getStat(player, type.id).attempts, 0);
      const shotPct = totalAttempts > 0 ? Math.round((totalGoals / totalAttempts) * 100) : null;
      const initials = player.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
      const isAanval = player.position === 'aanval';

      return (
        <button
          onClick={() => setShowGoalModal(player)}
          disabled={isModalOpen}
          className="bg-white dark:bg-gray-800 border border-black/[.06] dark:border-gray-700 rounded-2xl p-3 text-left flex flex-col gap-2.5 active:scale-[0.97] transition-transform disabled:opacity-50"
        >
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-black text-[11px] text-white flex-shrink-0 ${isAanval ? 'bg-primary' : 'bg-ink-900 dark:bg-gray-600'}`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[12px] text-ink-900 dark:text-white truncate">{player.name.split(' ')[0]}</div>
              <div className="stencil text-[8px] text-gray-400">{isAanval ? 'Aanval' : 'Verdediging'}</div>
            </div>
          </div>
          <div className="flex items-end justify-between gap-1">
            <div>
              <div className="score-number text-[22px] text-ink-900 dark:text-white">{totalGoals}</div>
              <div className="stencil text-[8px] text-gray-400 mt-0.5">Doelpunten</div>
            </div>
            {currentMatch?.withAttempts !== false && shotPct !== null && (
              <div className="text-right">
                <div className={`font-bold text-[13px] tabular ${shotPct >= 60 ? 'text-green-600' : 'text-gray-500'}`}>{shotPct}%</div>
                <div className="stencil text-[8px] text-gray-400 mt-0.5">Schot%</div>
              </div>
            )}
            {currentMatch?.withAttempts !== false && shotPct === null && (
              <button
                onClick={e => { e.stopPropagation(); setShowAttemptModal(player); }}
                className="text-[10px] font-semibold text-gray-300 hover:text-primary transition"
              >
                Poging
              </button>
            )}
          </div>
        </button>
      );
    };

    const lastGoal = currentMatch.goals?.length > 0
      ? currentMatch.goals[currentMatch.goals.length - 1]
      : null;

    return (
      <div className="min-h-screen bg-canvas dark:bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-black/[.06] dark:border-gray-800 bg-canvas dark:bg-gray-900 sticky top-0 z-10">
          <button onClick={() => navigateTo('home')} className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-black/[.08] flex items-center justify-center" aria-label="Terug">
            <ArrowLeft className="w-4 h-4 text-ink-900 dark:text-white" />
          </button>
          <div className="text-center">
            <div className="font-bold text-[13px] text-ink-900 dark:text-white">vs {currentMatch.opponent}</div>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-live pulse-ring flex-shrink-0" />
              <span className="stencil text-[9px] text-live tracking-[0.12em]">LIVE · {timerRunning ? '2E HELFT' : 'GEPAUZEERD'}</span>
            </div>
          </div>
          <button
            onClick={undoLastAction}
            disabled={actionHistory.length === 0}
            className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-black/[.08] flex items-center justify-center disabled:opacity-30"
            aria-label="Ongedaan maken"
          >
            <RotateCcw className="w-4 h-4 text-ink-900 dark:text-white" />
          </button>
        </div>

        {/* Score display */}
        <div className="px-4 py-4 bg-white dark:bg-gray-800 border-b border-black/[.06] dark:border-gray-800">
          <div className="grid grid-cols-3 items-center gap-2">
            <div className="text-center">
              <div className="stencil text-ink-500 mb-2">{currentMatch.team?.split(' ').slice(-1)[0] || 'Thuis'}</div>
              <div key={scoreAnimKey} className={`score-number text-[56px] text-primary ${scoreAnimKey > 0 ? 'score-pop-big' : ''}`}>{currentMatch.score}</div>
            </div>
            <div className="text-center">
              <button
                onClick={() => setTimerRunning(r => !r)}
                className="font-mono text-[12px] font-bold text-ink-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2.5 py-1.5 rounded-lg tabular"
                aria-label={timerRunning ? 'Timer pauzeren' : 'Timer hervatten'}
              >
                {formatTimer(timerSeconds)}
              </button>
            </div>
            <div className="text-center">
              <div className="stencil text-ink-500 mb-2">{currentMatch.opponent}</div>
              <div className="score-number text-[56px] text-ink-400 dark:text-gray-500">{currentMatch.opponentScore}</div>
            </div>
          </div>
        </div>

        {/* Filter + laatste actie */}
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="text-[11px] text-ink-500 font-medium min-w-0 truncate flex-1 mr-2">
            {lastGoal?.isOwn
              ? <span>Laatste: <span className="font-bold text-ink-900 dark:text-white">{lastGoal.playerName?.split(' ')[0]}</span></span>
              : <span className="text-ink-400">Tap speler om te scoren</span>
            }
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {[['alle','Alle'],['aanval','Aanval'],['verdediging','Verd.']].map(([val, label]) => (
              <button key={val} onClick={() => setPosFilter(val)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${posFilter === val ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900' : 'text-ink-500'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Player grid */}
        <div className="flex-1 overflow-y-auto px-3 pb-2">
          {visibleStarters.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              {visibleStarters.map(player => <PlayerCard key={player.id} player={player} />)}
            </div>
          )}
          {bench.length > 0 && (
            <div className="mb-2">
              <div className="stencil text-[9px] text-gray-400 px-1 mb-1.5">Wisselspelers</div>
              <div className="grid grid-cols-2 gap-2">
                {bench.map(player => <PlayerCard key={player.id} player={player} />)}
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="px-3 py-3 bg-white dark:bg-gray-900 border-t border-black/[.06] dark:border-gray-800 flex gap-2">
          <button onClick={() => setShowOpponentModal(true)}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-3 rounded-xl text-[12px] font-bold active:scale-[0.97] transition-transform">
            − Tegenpunt
          </button>
          <button onClick={() => setShowSubstitutionModal(true)}
            className="flex-1 bg-ink-900 dark:bg-gray-700 text-white py-3 rounded-xl text-[12px] font-bold active:scale-[0.97] transition-transform">
            Wissel
          </button>
          <button onClick={finishMatch}
            className="flex-[1.3] bg-primary text-white py-3 rounded-xl text-[12px] font-bold hover:bg-primary-dark active:scale-[0.97] transition-transform">
            Einde
          </button>
        </div>

        {showGoalModal && <ShotTypeModal title={`Goal — ${showGoalModal.name}`}
          onSelect={(type) => addGoal(showGoalModal.id, type)} onClose={() => setShowGoalModal(null)} />}
        {showAttemptModal && <ShotTypeModal title="Schotpoging registreren"
          onSelect={(type) => addAttempt(showAttemptModal.id, type)} onClose={() => setShowAttemptModal(null)} />}
        {showOpponentModal && <ShotTypeModal title="Tegendoelpunt type"
          onSelect={addOpponentGoal} onClose={() => setShowOpponentModal(false)} />}
        {showOpponentPlayerModal && <PlayerSelectModal title="Wie kreeg doelpunt tegen?" players={currentMatch.players}
          onSelect={(playerId) => addOpponentGoalWithPlayer(playerId, showOpponentPlayerModal)}
          onClose={() => setShowOpponentPlayerModal(null)} />}
        {showSubstitutionModal && <SubstitutionModal
          players={currentMatch.players}
          onSubstitute={registerSubstitution}
          onClose={() => setShowSubstitutionModal(false)} />}
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
      <div className="fixed inset-0 bg-ink-900/45 flex items-end z-50"
        role="dialog" aria-modal="true" aria-label={title} onClick={onClose} ref={modalRef}>
        <div className="w-full bg-white dark:bg-gray-900 rounded-t-[20px] p-5 pb-6" onClick={e => e.stopPropagation()}>
          <div className="w-9 h-1 bg-black/10 rounded-full mx-auto mb-4" />
          <div className="font-display font-black text-[20px] text-ink-900 dark:text-white mb-1 tracking-tight">{title}</div>
          <div className="text-[12px] text-gray-400 font-medium mb-4">Welk schottype?</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {SHOT_TYPES.map(type => (
              <button key={type.id} onClick={() => onSelect(type.id)}
                className="bg-[#FAFAF7] dark:bg-gray-800 border border-black/[.06] dark:border-gray-700 text-ink-900 dark:text-white p-3 rounded-xl active:scale-95 transition-all font-semibold text-sm text-left flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-primary">
                <span className="w-7 h-7 rounded-lg bg-primary text-white font-display font-black text-[10px] flex items-center justify-center flex-shrink-0">
                  {type.short}
                </span>
                {type.label}
              </button>
            ))}
          </div>
          <button onClick={onClose}
            className="w-full py-3 text-sm font-semibold text-gray-400 hover:text-gray-600 transition focus-visible:ring-2 focus-visible:ring-primary">
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
      <div className="fixed inset-0 bg-ink-900/45 flex items-end z-50"
        role="dialog" aria-modal="true" aria-label={title} onClick={onClose} ref={modalRef}>
        <div className="w-full bg-white rounded-t-[20px] p-5 pb-6 max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="w-9 h-1 bg-black/10 rounded-full mx-auto mb-4 flex-shrink-0" />
          <div className="font-display font-black text-[20px] text-ink-900 mb-4 tracking-tight flex-shrink-0">{title}</div>
          <div className="overflow-y-auto space-y-1.5 mb-3">
            {players.map(player => {
              const isAanval = player.position === 'aanval';
              const initials = player.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
              return (
                <button key={player.id} onClick={() => onSelect(player.id)}
                  className="w-full bg-[#FAFAF7] border border-black/[.06] text-ink-900 px-3.5 py-3 rounded-xl active:scale-[0.98] transition-all font-semibold text-left text-sm flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-primary">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-black text-[11px] text-white flex-shrink-0 ${isAanval ? 'bg-primary' : 'bg-ink-900'}`}>
                    {initials}
                  </div>
                  <div>
                    <div className="font-bold text-[13px]">{player.name}</div>
                    <div className="stencil text-[8px] text-gray-400 mt-0.5">{isAanval ? 'Aanval' : 'Verdediging'}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={onClose}
            className="w-full py-3 text-sm font-semibold text-gray-400 hover:text-gray-600 transition flex-shrink-0 focus-visible:ring-2 focus-visible:ring-primary">
            Annuleren
          </button>
        </div>
      </div>
    );
  };

  // ─── SubstitutionModal ────────────────────────────────────────────────────────
  const SubstitutionModal = ({ players, onSubstitute, onClose }) => {
    const [outPlayer, setOutPlayer] = useState(null);
    const modalRef = useRef(null);

    const starters = players.filter(p => p.isStarter);
    const bench = players.filter(p => !p.isStarter);

    useEffect(() => {
      const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => modalRef.current?.querySelector('button')?.focus(), 50);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
      <div className="fixed inset-0 bg-ink-900/45 flex items-end z-50"
        role="dialog" aria-modal="true" aria-label="Wissel registreren" onClick={onClose} ref={modalRef}>
        <div className="w-full bg-white rounded-t-[20px] p-5 pb-6 max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="w-9 h-1 bg-black/10 rounded-full mx-auto mb-4 flex-shrink-0" />
          <div className="font-display font-black text-[20px] text-ink-900 mb-1 tracking-tight flex-shrink-0">
            Wissel registreren
          </div>
          <div className="text-[12px] text-gray-400 font-medium mb-4 flex-shrink-0">
            {!outPlayer ? 'Wie gaat eraf?' : (
              <span><span className="font-bold text-primary">{outPlayer.name}</span> gaat eraf — wie komt erin?</span>
            )}
          </div>
          <div className="overflow-y-auto space-y-1.5 mb-3">
            {!outPlayer ? (
              starters.map(p => {
                const isAanval = p.position === 'aanval';
                const initials = p.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <button key={p.id} onClick={() => setOutPlayer(p)}
                    className="w-full bg-[#FAFAF7] border border-black/[.06] px-3.5 py-3 rounded-xl active:scale-[0.98] transition-all text-left flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-primary">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-black text-[11px] text-white flex-shrink-0 ${isAanval ? 'bg-primary' : 'bg-ink-900'}`}>
                      {initials}
                    </div>
                    <div>
                      <div className="font-bold text-[13px] text-ink-900">{p.name}</div>
                      <div className="stencil text-[8px] text-gray-400 mt-0.5">{isAanval ? 'Aanval' : 'Verdediging'} · Basis</div>
                    </div>
                  </button>
                );
              })
            ) : bench.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Geen wisselspelers beschikbaar</p>
            ) : (
              bench.map(p => {
                const isAanval = p.position === 'aanval';
                const initials = p.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <button key={p.id} onClick={() => onSubstitute(outPlayer.id, p.id)}
                    className="w-full bg-[#FAFAF7] border border-black/[.06] px-3.5 py-3 rounded-xl active:scale-[0.98] transition-all text-left flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-primary">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-black text-[11px] text-white flex-shrink-0 ${isAanval ? 'bg-primary' : 'bg-ink-900'}`}>
                      {initials}
                    </div>
                    <div>
                      <div className="font-bold text-[13px] text-ink-900">{p.name}</div>
                      <div className="stencil text-[8px] text-gray-400 mt-0.5">{isAanval ? 'Aanval' : 'Verdediging'} · Wissel</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {outPlayer && (
              <button onClick={() => setOutPlayer(null)}
                className="flex-1 py-3 text-sm font-semibold text-gray-400 hover:text-ink-900 transition focus-visible:ring-2 focus-visible:ring-primary">
                ← Andere speler
              </button>
            )}
            <button onClick={onClose}
              className="flex-1 py-3 text-sm font-semibold text-gray-400 hover:text-gray-600 transition focus-visible:ring-2 focus-visible:ring-primary">
              Annuleren
            </button>
          </div>
        </div>
      </div>
    );
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const MatchSummaryView = () => {
    const match = currentMatch;

    if (!match || !match.players) {
      return <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Geen wedstrijd gevonden</p>
          <button onClick={() => navigateTo('home')}
            className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-dark transition">
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

    const isWin = match.score > match.opponentScore;
    const isLoss = match.score < match.opponentScore;

    return (
      <div className="min-h-screen bg-canvas dark:bg-gray-900">
        {/* Dark hero header */}
        <div className="bg-ink-900 relative overflow-hidden">
          <div className="field-pattern absolute inset-0 opacity-50" />
          <div className="relative px-4 pt-4 pb-5">
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => { setCurrentMatch(null); navigateTo('home'); }}
                className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center" aria-label="Terug">
                <ArrowLeft className="w-4 h-4 text-white" />
              </button>
              <div className="font-bold text-[13px] text-white">Wedstrijdverslag</div>
              <button
                onClick={async () => {
                  try {
                    let matchId = match._id;
                    if (!matchId) {
                      const normPlayers = (match.players || []).map(p => ({
                        id: p.id, name: p.name, isStarter: p.isStarter ?? false,
                        stats: SHOT_TYPES.reduce((acc, type) => ({
                          ...acc, [type.id]: { goals: Number(p.stats?.[type.id]?.goals) || 0, attempts: Number(p.stats?.[type.id]?.attempts) || 0 }
                        }), {})
                      })).filter(p => p.id !== undefined && p.id !== null);
                      const normGoals = (match.goals || []).filter(g => g.playerId !== undefined).map(g => ({
                        playerId: g.playerId, playerName: g.playerName ?? 'Onbekend',
                        shotType: g.shotType ?? 'other', timestamp: g.timestamp ?? new Date().toISOString(), isOwn: g.isOwn ?? false,
                      }));
                      const normOppGoals = (match.opponentGoals || []).map(g => ({
                        type: g.type ?? 'other', time: g.time ?? new Date().toISOString(), concededBy: g.concededBy ?? 'Onbekend',
                      }));
                      matchId = await createMatchMutation({
                        teamId: currentTeamId, teamName: currentTeam ?? '', opponent: match.opponent ?? '',
                        date: match.date ?? new Date().toISOString(), players: normPlayers,
                        score: Number(match.score) || 0, opponentScore: Number(match.opponentScore) || 0,
                        opponentGoals: normOppGoals, goals: normGoals, finished: true, shareable: true,
                      });
                      setCurrentMatch(prev => prev ? { ...prev, _id: matchId } : prev);
                      localStorage.removeItem('korfbal_active_match');
                    } else {
                      await updateMatchMutation({ matchId, shareable: true });
                    }
                    const shareUrl = `${window.location.origin}${window.location.pathname}?match=${matchId}`;
                    await navigator.clipboard.writeText(shareUrl);
                    showFeedback('Deel-link gekopieerd!', 'success');
                  } catch (error) {
                    showFeedback(`Fout bij delen: ${error.message || 'Onbekende fout'}`, 'error');
                  }
                }}
                className="stencil text-primary bg-primary/20 border border-primary/30 px-3 py-1.5 rounded-lg text-[10px]"
              >
                Deel
              </button>
            </div>
            <div className="stencil text-white/55 mb-3">
              {match.date ? new Date(match.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold mb-4 ${
              isWin ? 'bg-green-500/20 border-green-500/30 text-green-300'
              : isLoss ? 'bg-red-500/20 border-red-500/30 text-red-300'
              : 'bg-white/10 border-white/20 text-white/70'
            }`}>
              {isWin ? '✓ GEWONNEN' : isLoss ? 'VERLOREN' : 'GELIJKSPEL'}
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div>
                <div className="font-bold text-[13px] text-white">{match.team}</div>
                <div className="stencil text-white/45 mt-1">Thuis</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="score-number text-[52px] text-white">{match.score}</div>
                <div className="font-light text-[22px] text-white/30 font-display">–</div>
                <div className="score-number text-[52px] text-white/55">{match.opponentScore}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-[13px] text-white">{match.opponent}</div>
                <div className="stencil text-white/45 mt-1">Uit</div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-24 space-y-3 pt-4">
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
            className="hidden"
          >
          </button>

          {/* Mini stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-3.5">
              <div className="score-number text-[22px] text-ink-900 dark:text-white">{totalGoals}</div>
              <div className="stencil text-ink-500 mt-1.5">Doelpunten</div>
            </div>
            {match?.withAttempts !== false && totalAttempts > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-3.5">
                <div className="score-number text-[22px] text-ink-900 dark:text-white">{teamPercentage}%</div>
                <div className="stencil text-ink-500 mt-1.5">Schot%</div>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-3.5">
              <div className="score-number text-[22px] text-ink-900 dark:text-white">{match?.withAttempts !== false ? totalAttempts : match.players.length}</div>
              <div className="stencil text-ink-500 mt-1.5">{match?.withAttempts !== false ? 'Pogingen' : 'Spelers'}</div>
            </div>
          </div>

          {/* Topscoorders */}
          {bestPlayer && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-4">
              <div className="stencil text-ink-500 mb-3">Topscoorders</div>
              {[...match.players]
                .map(p => ({ ...p, g: SHOT_TYPES.reduce((s, t) => s + getStat(p, t.id).goals, 0) }))
                .sort((a, b) => b.g - a.g)
                .filter(p => p.g > 0)
                .slice(0, 3)
                .map((player, i) => (
                  <div key={player.id} className={`flex items-center gap-3 py-2.5 ${i < 2 ? 'border-b border-black/[.05] dark:border-gray-700' : ''}`}>
                    <span className={`font-display font-black text-[14px] w-4 ${i === 0 ? 'text-gold-500' : 'text-ink-400'}`}>{i + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-display font-black text-[11px] text-white flex-shrink-0">
                      {player.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 font-bold text-[13px] text-ink-900 dark:text-white">{player.name}</div>
                    <div className="score-number text-[20px] text-ink-900 dark:text-white">{player.g}</div>
                  </div>
                ))
              }
            </div>
          )}

          {/* Schot% per type */}
          {shotTypeStats.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-4">
              <div className="stencil text-ink-500 mb-3">Schot% per type</div>
              <div className="space-y-3">
                {shotTypeStats.map(stat => (
                  <div key={stat.type}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="font-semibold text-[13px] text-ink-900 dark:text-white">{stat.type}</span>
                      <span className={`font-bold text-[13px] tabular ${stat.percentage >= 60 ? 'text-green-600' : 'text-primary'}`}>{stat.percentage}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${stat.percentage >= 60 ? 'bg-green-500' : 'bg-primary'}`}
                        style={{ width: `${stat.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scoreverloop */}
          {scoreTimeline.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-4">
              <div className="stencil text-ink-500 mb-3">Scoreverloop</div>
              <div className="space-y-1.5">
                {scoreTimeline.map((goal, idx) => {
                  const sc = scoreTimeline.slice(0, idx + 1).filter(g => g.isOwn).length;
                  const osc = scoreTimeline.slice(0, idx + 1).filter(g => !g.isOwn).length;
                  return (
                    <div key={idx} className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${goal.isOwn ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${goal.isOwn ? 'bg-green-500' : 'bg-primary'}`} />
                        <span className="font-semibold text-[12px] text-ink-900 dark:text-white truncate">
                          {goal.isOwn ? goal.player : `Tegen ${goal.player}`}
                        </span>
                        <span className="text-[11px] text-ink-500 flex-shrink-0">· {goal.type}</span>
                      </div>
                      <div className="score-number text-[16px] text-ink-900 dark:text-white flex-shrink-0 ml-2">{sc}–{osc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Wisselingen */}
          {(match.substitutions || []).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-4">
              <div className="stencil text-ink-500 mb-3">Wisselingen</div>
              <div className="space-y-1.5">
                {(match.substitutions || []).map((sub, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-2 border-b border-black/[.04] last:border-0 text-[13px]">
                    <span className="font-semibold text-primary">{sub.outPlayerName}</span>
                    <span className="text-ink-400">→</span>
                    <span className="font-semibold text-green-600">{sub.inPlayerName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => { setCurrentMatch(null); navigateTo('home'); }}
            className="w-full bg-ink-900 text-white py-4 rounded-2xl font-bold text-[14px] hover:bg-ink-800 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            Terug naar home
          </button>
        </div>
      </div>
    );
  };

  const SkeletonCard = ({ lines = 3 }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4 animate-pulse">
      <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-full w-1/3 mb-4"></div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3" style={{ width: `${80 - i * 15}%` }}></div>
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
    const [filterSeasonId, setFilterSeasonId] = useState(null); // null = alle seizoenen
    const [filterCompetition, setFilterCompetition] = useState(null); // null = beide

    // Server-side stats queries — pass active season/competition filter
    const statsFilter = currentTeamId
      ? {
          teamId: currentTeamId,
          ...(filterSeasonId ? { seasonId: filterSeasonId } : {}),
          ...(filterCompetition ? { competition: filterCompetition } : {}),
        }
      : 'skip';

    const formLast5 = useQuery(api.stats.getFormLastN, statsFilter !== 'skip' ? { ...statsFilter, n: 5 } : 'skip');
    const opponentStats = useQuery(api.stats.getOpponentStats, statsFilter);
    const playerOfMonth = useQuery(api.stats.getPlayerOfMonth, currentTeamId ? { teamId: currentTeamId } : 'skip');
    const topPlayers = useQuery(api.stats.getTopPlayers, statsFilter !== 'skip' ? { ...statsFilter, limit: 5 } : 'skip');
    const currentStreak = useQuery(api.stats.getCurrentStreak, statsFilter);
    // Fase 4 — nieuwe stats
    const trendByMonth = useQuery(api.stats.getTrendByMonth, statsFilter);
    const shotTypeTrend = useQuery(api.stats.getShotTypeTrend, currentTeamId ? { teamId: currentTeamId, n: 10 } : 'skip');
    const careerStats = useQuery(api.stats.getPlayerCareerStats, currentTeamId ? { teamId: currentTeamId } : 'skip');

    // Memoize team matches filter (with optional season/competition filter)
    const teamMatches = useMemo(() => {
      return matches.filter(m => {
        if (m.team_id !== currentTeamId) return false;
        if (filterSeasonId && m.season_id !== filterSeasonId) return false;
        if (filterCompetition && m.competition !== filterCompetition) return false;
        return true;
      });
    }, [matches, currentTeamId, filterSeasonId, filterCompetition]);

    // Memoize expensive player stats calculation
    const playerStats = useMemo(() => {
      const stats = {};

      teamMatches.forEach(match => {
        if (!match.players || !Array.isArray(match.players)) return;
        const hasAttempts = match.with_attempts !== false;
        match.players.forEach(player => {
          if (!player || !player.name) return;
          if (!stats[player.name]) {
            stats[player.name] = {
              matches: 0,
              goals: 0,         // alle doelpunten (compleet)
              attemptGoals: 0,  // doelpunten alleen uit wedstrijden met pogingen
              attempts: 0,      // pogingen alleen uit wedstrijden met pogingen
              byType: SHOT_TYPES.reduce((acc, type) => ({
                ...acc,
                [type.id]: { goals: 0, attemptGoals: 0, attempts: 0 }
              }), {})
            };
          }
          stats[player.name].matches++;
          SHOT_TYPES.forEach(type => {
            const typeStats = player.stats?.[type.id] || { goals: 0, attempts: 0 };
            const g = typeStats.goals || 0;
            const a = typeStats.attempts || 0;
            stats[player.name].goals += g;
            stats[player.name].byType[type.id].goals += g;
            if (hasAttempts) {
              stats[player.name].attemptGoals += g;
              stats[player.name].attempts += a;
              stats[player.name].byType[type.id].attemptGoals += g;
              stats[player.name].byType[type.id].attempts += a;
            }
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

    return (
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-gray-900">
        {/* Header */}
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-black/[.06] dark:border-gray-800 bg-[#FAFAF7] dark:bg-gray-900 sticky top-0 z-10">
          <button onClick={() => navigateTo('home')} className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-black/[.08] flex items-center justify-center" aria-label="Terug">
            <ArrowLeft className="w-4 h-4 text-ink-900 dark:text-white" />
          </button>
          <span className="font-bold text-[13px] text-ink-900 dark:text-white">Statistieken</span>
          <button
            onClick={exportToCSV}
            className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-black/[.08] flex items-center justify-center hover:border-primary transition"
            aria-label="Exporteer CSV"
          >
            <Download className="w-4 h-4 text-ink-900 dark:text-white" />
          </button>
        </div>
        <div className="max-w-4xl mx-auto px-4 pb-24 pt-4 space-y-4">
          {/* Headline */}
          <div>
            <h1 className="font-display font-black text-[28px] leading-tight tracking-tight text-ink-900 dark:text-white">
              {currentTeam}<br /><span className="text-primary">onder de loep.</span>
            </h1>
          </div>

          {/* Seizoen / competitie filter */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-3 flex flex-wrap gap-2 items-center">
            {seasons && seasons.length > 0 && (
              <>
                <span className="stencil text-[9px] text-gray-400 mr-1">Seizoen:</span>
                <button
                  onClick={() => { setFilterSeasonId(null); setFilterCompetition(null); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${!filterSeasonId ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                >
                  Alle
                </button>
                {seasons.map(s => (
                  <button
                    key={s._id}
                    onClick={() => { setFilterSeasonId(s._id); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${filterSeasonId === s._id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                  >
                    {s.name}
                  </button>
                ))}
                <span className="text-gray-200 dark:text-gray-600">|</span>
              </>
            )}
            <span className="stencil text-[9px] text-gray-400 mr-1">Type:</span>
            {[null, 'veld', 'zaal'].map(type => (
              <button
                key={type ?? 'all'}
                onClick={() => setFilterCompetition(type)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${filterCompetition === type ? 'bg-ink-900 dark:bg-gray-200 text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
              >
                {type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Alles'}
              </button>
            ))}
          </div>
          {teamMatches === undefined ? (
            <>
              <SkeletonCard lines={4} />
              <SkeletonCard lines={5} />
              <SkeletonCard lines={3} />
            </>
          ) : teamMatches.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-8 text-center">
              <BarChart3 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <h2 className="font-display font-black text-xl text-ink-900 dark:text-white mb-2">
                {filterSeasonId ? 'Geen wedstrijden' : 'Nog geen statistieken'}
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                {filterSeasonId
                  ? 'Geen wedstrijden gevonden voor dit seizoen.'
                  : 'Speel je eerste wedstrijd om statistieken te verzamelen.'}
              </p>
              {!filterSeasonId && (
                <button onClick={() => navigateTo('setup-match')}
                  className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-dark transition">
                  Nieuwe wedstrijd starten
                </button>
              )}
            </div>
          ) : (
          <>
          {/* Hoofd stats kaart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-5">
            <div className="flex justify-between items-end mb-4">
              <div>
                <div className="score-number text-[52px] text-ink-900 dark:text-white leading-none">
                  {wins}<span className="font-display font-semibold text-[22px] text-gray-300 dark:text-gray-600">/{teamMatches.length}</span>
                </div>
                <div className="stencil text-[10px] text-gray-400 mt-1.5">Wedstrijden gewonnen</div>
              </div>
              {formLast5 && formLast5.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="stencil text-[9px] text-gray-400 mr-1">Vorm</span>
                  {formLast5.map((m, i) => (
                    <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center font-display font-black text-[10px] text-white ${m.result === 'W' ? 'bg-green-500' : m.result === 'D' ? 'bg-gray-400' : 'bg-primary'}`}>
                      {m.result}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 pt-4 border-t border-black/[.06] dark:border-gray-700">
              <div className="text-center">
                <div className="score-number text-[22px] text-primary">{totalGoals}</div>
                <div className="stencil text-[9px] text-gray-400 mt-1">Voor</div>
              </div>
              <div className="text-center border-x border-black/[.06] dark:border-gray-700">
                <div className="score-number text-[22px] text-gray-400">{totalAgainst}</div>
                <div className="stencil text-[9px] text-gray-400 mt-1">Tegen</div>
              </div>
              <div className="text-center">
                <div className="score-number text-[22px] text-ink-900 dark:text-white">
                  {totalAgainst > 0 ? (totalGoals > totalAgainst ? '+' : '') : ''}{totalGoals - totalAgainst}
                </div>
                <div className="stencil text-[9px] text-gray-400 mt-1">Saldo</div>
              </div>
            </div>
          </div>
          {/* Huidige reeks */}
          {currentStreak && currentStreak.count >= 2 && (
            <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
              currentStreak.type === 'W'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200/60 dark:border-green-700/40'
                : currentStreak.type === 'V'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200/60 dark:border-red-700/40'
                : 'bg-white dark:bg-gray-800 border-black/[.06] dark:border-gray-700'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-[18px] flex-shrink-0 ${
                currentStreak.type === 'W' ? 'bg-green-500 text-white' : currentStreak.type === 'V' ? 'bg-primary text-white' : 'bg-gray-300 text-white'
              }`}>
                {currentStreak.count}
              </div>
              <div>
                <div className={`font-bold text-[14px] ${
                  currentStreak.type === 'W' ? 'text-green-700 dark:text-green-300'
                  : currentStreak.type === 'V' ? 'text-primary'
                  : 'text-ink-900 dark:text-white'
                }`}>
                  {currentStreak.type === 'W' ? 'Overwinningen' : currentStreak.type === 'V' ? 'Nederlagen' : 'Gelijke spelen'} op rij
                </div>
                <div className="stencil text-ink-500 mt-0.5">Huidige reeks</div>
              </div>
            </div>
          )}
          {/* Vorm-strip: laatste 5 wedstrijden */}
          {formLast5 && formLast5.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4">
              <div className="stencil text-ink-500 mb-3">Vorm laatste {formLast5.length} wedstrijden</div>
              <div className="flex items-center gap-2 flex-wrap">
                {formLast5.map((m, i) => (
                  <div key={m.matchId || i} className="flex flex-col items-center gap-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-display font-black text-[12px] text-white ${
                      m.result === 'W' ? 'bg-green-500' : m.result === 'D' ? 'bg-gray-400' : 'bg-primary'
                    }`}>
                      {m.result}
                    </div>
                    <span className="tabular text-[10px] text-ink-500">{m.score}-{m.opponentScore}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Speler van de maand */}
          {playerOfMonth && (
            <div className="bg-ink-900 rounded-2xl p-4 relative overflow-hidden">
              <div className="field-pattern absolute inset-0 opacity-40" />
              <div className="relative">
                <div className="stencil text-white/50 mb-2">Speler van de maand</div>
                <div className="font-display font-black text-[22px] text-white leading-tight">{playerOfMonth.name}</div>
                <div className="stencil text-white/60 mt-1.5">{playerOfMonth.goals} doelpunten · afgelopen 30 dagen</div>
              </div>
            </div>
          )}

          {/* Beste spelers top 5 */}
          {topPlayers && topPlayers.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4">
              <div className="stencil text-ink-500 mb-3">Top scorers</div>
              <div className="space-y-0">
                {topPlayers.map((p, i) => (
                  <div key={p.playerId} className={`flex items-center gap-3 py-2.5 ${i < topPlayers.length - 1 ? 'border-b border-black/[.05] dark:border-gray-700' : ''}`}>
                    <span className={`font-display font-black text-[14px] w-4 flex-shrink-0 ${i === 0 ? 'text-gold-500' : 'text-ink-400'}`}>{i + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-display font-black text-[11px] text-white flex-shrink-0">
                      {p.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="flex-1 font-bold text-[13px] text-ink-900 dark:text-white">{p.name}</span>
                    <span className="tabular text-[12px] text-ink-500">{p.goals}</span>
                    <span className="tabular text-[12px] font-bold text-primary">{p.percentage}%</span>
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
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4">
                <div className="stencil text-ink-500 mb-0.5">Doelpunten per maand</div>
                <p className="text-[11px] text-ink-400 mb-3">Gemiddeld per wedstrijd · {trendByMonth.length} maanden</p>
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4">
              <div className="stencil text-ink-500 mb-3">Resultaten per tegenstander</div>
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
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4">
                <div className="stencil text-ink-500 mb-0.5">Schot-type trend</div>
                <p className="text-[11px] text-ink-400 mb-3">
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4">
              <div className="stencil text-ink-500 mb-3">Prestatie per wedstrijd</div>
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4">
            <div className="stencil text-ink-500 mb-3">Speler statistieken</div>
            <div className="space-y-0">
              {Object.entries(playerStats).sort(([, a], [, b]) => b.goals - a.goals).map(([name, stats], index) => {
                const percentage = stats.attempts > 0 ? Math.round((stats.attemptGoals / stats.attempts) * 100) : 0;
                const avgPerMatch = stats.matches > 0 ? (stats.goals / stats.matches).toFixed(1) : 0;
                const isExpanded = expandedPlayer === name;
                const career = careerStats?.find(c => c.name === name);

                return (
                  <div key={name} className={`py-3 ${index > 0 ? 'border-t border-black/[.05] dark:border-gray-700' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className={`font-display font-black text-[14px] w-4 flex-shrink-0 ${index === 0 ? 'text-gold-500' : 'text-ink-400'}`}>{index + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-display font-black text-[11px] text-white flex-shrink-0">
                        {name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          className="font-bold text-[13px] text-ink-900 dark:text-white text-left flex items-center gap-1 hover:text-primary transition-colors"
                          onClick={() => setExpandedPlayer(isExpanded ? null : name)}
                          aria-expanded={isExpanded}
                        >
                          {name}
                          <span className={`text-ink-400 transition-transform duration-200 text-[10px] ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                        </button>
                        <div className="text-[11px] text-ink-500 flex items-center gap-2 flex-wrap mt-0.5">
                          <span>{stats.matches} wedstr. · {avgPerMatch}/wedstr.</span>
                          {career?.bestShotTypeLabel && (
                            <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded font-bold">
                              {career.bestShotTypeLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="score-number text-[20px] text-ink-900 dark:text-white">{stats.goals}</div>
                        {stats.attempts > 0 && <div className={`text-[11px] font-bold ${percentage >= 50 ? 'text-green-600' : 'text-primary'}`}>{percentage}%</div>}
                      </div>
                    </div>

                    {stats.attempts > 0 && (
                      <div className="mt-2 ml-11">
                        <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${percentage >= 70 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-400' : 'bg-primary'}`}
                            style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    )}

                    {isExpanded && (
                      <div className="mt-2 ml-11 grid grid-cols-3 gap-1.5">
                        {SHOT_TYPES.map(type => {
                          const typeStat = stats.byType[type.id];
                          if (typeStat.attempts === 0) return null;
                          const typePercentage = Math.round((typeStat.attemptGoals / typeStat.attempts) * 100);
                          return (
                            <div key={type.id} className="bg-gray-50 dark:bg-gray-700 rounded-xl px-2.5 py-2">
                              <div className="stencil text-ink-500 text-[9px]">{type.short}</div>
                              <div className="font-bold text-[12px] text-ink-900 dark:text-white mt-0.5">{typeStat.attemptGoals}/{typeStat.attempts}</div>
                              <div className={`text-[11px] font-bold ${typePercentage >= 50 ? 'text-green-600' : 'text-primary'}`}>{typePercentage}%</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Speler vergelijking */}
          {Object.keys(playerStats).length >= 2 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4">
              <div className="stencil text-ink-500 mb-3">Spelers vergelijken</div>
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] dark:border-gray-700 p-4">
            <div className="stencil text-ink-500 mb-3">Wedstrijd geschiedenis</div>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
                <input
                  type="text"
                  placeholder="Zoek op tegenstander..."
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-gray-700 border border-black/[.08] dark:border-gray-600 rounded-xl focus:border-primary focus:outline-none dark:text-gray-100 text-[13px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                />
              </div>
              <div className="flex gap-1">
                {[
                  { id: 'all', label: 'Alle' },
                  { id: 'won', label: 'W' },
                  { id: 'draw', label: 'G' },
                  { id: 'lost', label: 'V' },
                ].map(f => (
                  <button key={f.id} onClick={() => setMatchFilter(f.id)}
                    className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-colors ${
                      matchFilter === f.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-ink-500 hover:bg-gray-200'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-0">
              {[...teamMatches]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .filter(m => {
                  if (matchSearch && !m.opponent.toLowerCase().includes(matchSearch.toLowerCase())) return false;
                  if (matchFilter === 'won' && m.score <= m.opponent_score) return false;
                  if (matchFilter === 'lost' && m.score >= m.opponent_score) return false;
                  if (matchFilter === 'draw' && m.score !== m.opponent_score) return false;
                  return true;
                })
                .map((match, idx, arr) => (
                <div key={match._id} className={`flex items-center gap-3 py-2.5 ${idx < arr.length - 1 ? 'border-b border-black/[.05] dark:border-gray-700' : ''}`}>
                  <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${
                    match.score > match.opponent_score ? 'bg-green-500' :
                    match.score < match.opponent_score ? 'bg-primary' : 'bg-gray-300'
                  }`} />
                  <button onClick={() => setSelectedMatch(match)} className="flex-1 text-left min-w-0">
                    <div className="font-bold text-[13px] text-ink-900 dark:text-white truncate">{match.opponent}</div>
                    <div className="text-[11px] text-ink-500">{new Date(match.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</div>
                  </button>
                  <div className={`score-number text-[18px] flex-shrink-0 ${
                    match.score > match.opponent_score ? 'text-green-600' :
                    match.score < match.opponent_score ? 'text-primary' : 'text-ink-400'
                  }`}>
                    {match.score}–{match.opponent_score}
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await updateMatchMutation({ matchId: match._id, shareable: true });
                        const shareUrl = `${window.location.origin}${window.location.pathname}?match=${match._id}`;
                        await navigator.clipboard.writeText(shareUrl);
                        showFeedback('Deel-link gekopieerd!', 'success');
                      } catch (error) {
                        showFeedback('Fout bij delen', 'error');
                      }
                    }}
                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0"
                    aria-label="Deel wedstrijd"
                  >
                    <Share2 className="w-3.5 h-3.5 text-ink-500" />
                  </button>
                  {currentUserIsAdmin && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteMatch(match); }}
                      className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0" aria-label="Verwijder wedstrijd">
                      <X className="w-3.5 h-3.5 text-ink-500" />
                    </button>
                  )}
                </div>
              ))}
              {teamMatches.length > 0 && [...teamMatches].filter(m => {
                if (matchSearch && !m.opponent.toLowerCase().includes(matchSearch.toLowerCase())) return false;
                if (matchFilter === 'won' && m.score <= m.opponent_score) return false;
                if (matchFilter === 'lost' && m.score >= m.opponent_score) return false;
                if (matchFilter === 'draw' && m.score !== m.opponent_score) return false;
                return true;
              }).length === 0 && (
                <p className="text-center text-ink-500 py-4 text-[13px]">Geen wedstrijden gevonden</p>
              )}
            </div>
          </div>

          {/* AI Trainingsadvies — zichtbaar bij ≥ 3 wedstrijden, geïsoleerde error boundary */}
          {teamMatches.length >= 3 && (
            <AIAdviceCard teamId={currentTeamId} showFeedback={showFeedback} />
          )}
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
        <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Geen wedstrijd gevonden</p>
            <button
              onClick={() => {
                window.history.replaceState({}, '', window.location.pathname);
                navigateTo('login');
                setCurrentMatch(null);
              }}
              className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-dark transition"
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
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-gray-900">
        {/* Dark hero */}
        <div className="bg-ink-900 relative overflow-hidden">
          <div className="field-pattern absolute inset-0 opacity-50" />
          <div className="relative px-4 pt-5 pb-6">
            <div className="stencil text-white/55 mb-3">
              {match.date ? new Date(match.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold mb-4 ${
              match.score > match.opponent_score ? 'bg-green-500/20 border-green-500/30 text-green-300'
              : match.score < match.opponent_score ? 'bg-red-500/20 border-red-500/30 text-red-300'
              : 'bg-white/10 border-white/20 text-white/70'
            }`}>
              {match.score > match.opponent_score ? '✓ GEWONNEN' : match.score < match.opponent_score ? 'VERLOREN' : 'GELIJKSPEL'}
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div>
                <div className="font-bold text-[13px] text-white">{match.team_name}</div>
                <div className="stencil text-white/45 mt-1">Thuis</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="score-number text-[52px] text-white">{match.score}</div>
                <div className="font-light text-[22px] text-white/30 font-display">–</div>
                <div className="score-number text-[52px] text-white/55">{match.opponent_score}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-[13px] text-white">{match.opponent}</div>
                <div className="stencil text-white/45 mt-1">Uit</div>
              </div>
            </div>
            <div className="mt-4 text-[11px] font-medium text-white/40">Gedeeld door {match.team_name}</div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pb-24 pt-4 space-y-3">
          {/* Mini stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {match?.with_attempts !== false && totalAttempts > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-3.5">
                <div className="score-number text-[22px] text-ink-900 dark:text-white">{teamPercentage}%</div>
                <div className="stencil text-ink-500 mt-1.5">Schot%</div>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-3.5">
              <div className="score-number text-[22px] text-ink-900 dark:text-white">{totalGoals}</div>
              <div className="stencil text-ink-500 mt-1.5">Doelpunten</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-3.5">
              <div className="score-number text-[22px] text-ink-900 dark:text-white">{match.players.length}</div>
              <div className="stencil text-ink-500 mt-1.5">Spelers</div>
            </div>
          </div>

          {/* Topscorer */}
          {bestPlayer && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-4">
              <div className="stencil text-ink-500 mb-3">Topscorer</div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-display font-black text-[11px] text-white">
                  {bestPlayer.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 font-bold text-[13px] text-ink-900 dark:text-white">{bestPlayer.name}</div>
                <div className="score-number text-[20px] text-ink-900 dark:text-white">
                  {SHOT_TYPES.reduce((sum, type) => sum + (bestPlayer.stats?.[type.id]?.goals || 0), 0)}
                </div>
              </div>
            </div>
          )}

          {/* Schot% per type */}
          {shotTypeStats.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-4">
              <div className="stencil text-ink-500 mb-3">Schot% per type</div>
              <div className="space-y-3">
                {shotTypeStats.map(stat => (
                  <div key={stat.type}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="font-semibold text-[13px] text-ink-900 dark:text-white">{stat.type}</span>
                      <span className={`font-bold text-[13px] tabular ${stat.percentage >= 60 ? 'text-green-600' : 'text-primary'}`}>{stat.percentage}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${stat.percentage >= 60 ? 'bg-green-500' : 'bg-primary'}`}
                        style={{ width: `${stat.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scoreverloop */}
          {scoreTimeline.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-4">
              <div className="stencil text-ink-500 mb-3">Scoreverloop</div>
              <div className="space-y-1.5">
                {scoreTimeline.map((goal, idx) => {
                  const sc = scoreTimeline.slice(0, idx + 1).filter(g => g.isOwn).length;
                  const osc = scoreTimeline.slice(0, idx + 1).filter(g => !g.isOwn).length;
                  return (
                    <div key={idx} className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${goal.isOwn ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${goal.isOwn ? 'bg-green-500' : 'bg-primary'}`} />
                        <span className="font-semibold text-[12px] text-ink-900 dark:text-white truncate">
                          {goal.isOwn ? goal.player : `Tegen ${goal.player}`}
                        </span>
                        <span className="text-[11px] text-ink-500 flex-shrink-0">· {goal.type}</span>
                      </div>
                      <div className="score-number text-[16px] text-ink-900 dark:text-white flex-shrink-0 ml-2">{sc}–{osc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Speler statistieken */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-4">
            <div className="stencil text-ink-500 mb-3">Speler statistieken</div>
            {[...match.players].sort((a, b) => {
              const aGoals = SHOT_TYPES.reduce((sum, type) => sum + (a.stats?.[type.id]?.goals || 0), 0);
              const bGoals = SHOT_TYPES.reduce((sum, type) => sum + (b.stats?.[type.id]?.goals || 0), 0);
              return bGoals - aGoals;
            }).map(player => {
              const totalGoals = SHOT_TYPES.reduce((sum, type) => sum + (player.stats?.[type.id]?.goals || 0), 0);
              const totalAttempts = SHOT_TYPES.reduce((sum, type) => sum + (player.stats?.[type.id]?.attempts || 0), 0);
              const percentage = totalAttempts > 0 ? Math.round((totalGoals / totalAttempts) * 100) : 0;
              return (
                <div key={player.id} className="py-3 border-t border-black/[.06] dark:border-gray-700 first:border-0 first:pt-0">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-bold text-[13px] text-ink-900 dark:text-white">{player.name}</span>
                    <span className="text-[12px] text-ink-500 tabular">{totalGoals} dpt{match?.with_attempts !== false && totalAttempts > 0 ? ` · ${percentage}%` : ''}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SHOT_TYPES.map(type => {
                      const stat = player.stats?.[type.id];
                      if (!stat || stat.attempts === 0) return null;
                      return (
                        <span key={type.id} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-0.5 rounded-full text-[11px] font-medium">
                          {type.label}: {stat.goals}/{stat.attempts}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="bg-ink-900 rounded-2xl p-5 relative overflow-hidden">
            <div className="field-pattern absolute inset-0 opacity-30" />
            <div className="relative">
              <div className="stencil text-white/55 mb-2">Korfbal Score App</div>
              <div className="font-display font-black text-[18px] text-white leading-tight mb-3">Volg ook jouw<br />wedstrijden live.</div>
              <button
                onClick={() => {
                  window.history.replaceState({}, '', window.location.pathname);
                  navigateTo('login');
                  setCurrentMatch(null);
                }}
                className="bg-primary text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary-dark transition"
              >
                Maak gratis account →
              </button>
            </div>
          </div>
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

    const isWin = match.score > match.opponent_score;
    const isLoss = match.score < match.opponent_score;

    return (
      <div className="min-h-screen bg-canvas dark:bg-gray-900">
        {/* Dark hero */}
        <div className="bg-ink-900 relative overflow-hidden">
          <div className="field-pattern absolute inset-0 opacity-50" />
          <div className="relative px-4 pt-4 pb-5">
            <div className="flex items-center justify-between mb-5">
              <button onClick={onBack}
                className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center" aria-label="Terug">
                <ArrowLeft className="w-4 h-4 text-white" />
              </button>
              <div className="font-bold text-[13px] text-white">Wedstrijddetails</div>
              <div className="w-9" />
            </div>
            <div className="stencil text-white/55 mb-3">
              {match.date ? new Date(match.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold mb-4 ${
              isWin ? 'bg-green-500/20 border-green-500/30 text-green-300'
              : isLoss ? 'bg-red-500/20 border-red-500/30 text-red-300'
              : 'bg-white/10 border-white/20 text-white/70'
            }`}>
              {isWin ? '✓ GEWONNEN' : isLoss ? 'VERLOREN' : 'GELIJKSPEL'}
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div>
                <div className="font-bold text-[13px] text-white">{match.team_name}</div>
                <div className="stencil text-white/45 mt-1">Thuis</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="score-number text-[52px] text-white">{match.score}</div>
                <div className="font-light text-[22px] text-white/30 font-display">–</div>
                <div className="score-number text-[52px] text-white/55">{match.opponent_score}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-[13px] text-white">{match.opponent}</div>
                <div className="stencil text-white/45 mt-1">Uit</div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-24 space-y-3 pt-4">
          {/* Mini stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {match?.withAttempts !== false && totalAttempts > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-3.5">
                <div className="score-number text-[22px] text-ink-900 dark:text-white">{teamPercentage}%</div>
                <div className="stencil text-ink-500 mt-1.5">Schot%</div>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-3.5">
              <div className="score-number text-[22px] text-ink-900 dark:text-white">{totalGoals}</div>
              <div className="stencil text-ink-500 mt-1.5">Doelpunten</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-3.5">
              <div className="score-number text-[22px] text-ink-900 dark:text-white">{match.players.length}</div>
              <div className="stencil text-ink-500 mt-1.5">Spelers</div>
            </div>
          </div>

          {/* Topscorer */}
          {bestPlayer && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-4">
              <div className="stencil text-ink-500 mb-3">Topscorer</div>
              <div className="flex items-center gap-3">
                <span className="font-display font-black text-[14px] text-gold-500 w-4">1</span>
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-display font-black text-[11px] text-white">
                  {bestPlayer.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 font-bold text-[13px] text-ink-900 dark:text-white">{bestPlayer.name}</div>
                <div className="score-number text-[20px] text-ink-900 dark:text-white">
                  {SHOT_TYPES.reduce((sum, type) => sum + (bestPlayer.stats?.[type.id]?.goals || 0), 0)}
                </div>
              </div>
            </div>
          )}

          {/* Schot% per type */}
          {shotTypeStats.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-4">
              <div className="stencil text-ink-500 mb-3">Schot% per type</div>
              <div className="space-y-3">
                {shotTypeStats.map(stat => (
                  <div key={stat.type}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="font-semibold text-[13px] text-ink-900 dark:text-white">{stat.type}</span>
                      <span className={`font-bold text-[13px] tabular ${stat.percentage >= 60 ? 'text-green-600' : 'text-primary'}`}>{stat.percentage}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${stat.percentage >= 60 ? 'bg-green-500' : 'bg-primary'}`}
                        style={{ width: `${stat.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scoreverloop */}
          {scoreTimeline.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-4">
              <div className="stencil text-ink-500 mb-3">Scoreverloop</div>
              <div className="space-y-1.5">
                {scoreTimeline.map((goal, idx) => {
                  const sc = scoreTimeline.slice(0, idx + 1).filter(g => g.isOwn).length;
                  const osc = scoreTimeline.slice(0, idx + 1).filter(g => !g.isOwn).length;
                  return (
                    <div key={idx} className={`flex items-center justify-between px-3 py-2.5 rounded-xl ${goal.isOwn ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${goal.isOwn ? 'bg-green-500' : 'bg-primary'}`} />
                        <span className="font-semibold text-[12px] text-ink-900 dark:text-white truncate">
                          {goal.isOwn ? goal.player : `Tegen ${goal.player}`}
                        </span>
                        <span className="text-[11px] text-ink-500 flex-shrink-0">· {goal.type}</span>
                      </div>
                      <div className="score-number text-[16px] text-ink-900 dark:text-white flex-shrink-0 ml-2">{sc}–{osc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Spelerstatistieken */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-4">
            <div className="stencil text-ink-500 mb-3">Spelerstatistieken</div>
            <div className="space-y-0">
              {[...match.players].sort((a, b) => {
                const aG = SHOT_TYPES.reduce((s, t) => s + (a.stats?.[t.id]?.goals || 0), 0);
                const bG = SHOT_TYPES.reduce((s, t) => s + (b.stats?.[t.id]?.goals || 0), 0);
                return bG - aG;
              }).map((player, idx, arr) => {
                const pg = SHOT_TYPES.reduce((s, t) => s + (player.stats?.[t.id]?.goals || 0), 0);
                const pa = SHOT_TYPES.reduce((s, t) => s + (player.stats?.[t.id]?.attempts || 0), 0);
                const pct = pa > 0 ? Math.round((pg / pa) * 100) : 0;
                return (
                  <div key={player.id} className={`flex items-center gap-3 py-2.5 ${idx < arr.length - 1 ? 'border-b border-black/[.05] dark:border-gray-700' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-display font-black text-[11px] text-ink-500 flex-shrink-0">
                      {player.name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[13px] text-ink-900 dark:text-white truncate">{player.name}</div>
                      {pa > 0 && <div className="stencil text-ink-500 mt-0.5">{pg}/{pa} pogingen</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="score-number text-[18px] text-ink-900 dark:text-white">{pg}</div>
                      {pa > 0 && <div className={`text-[11px] font-bold ${pct >= 50 ? 'text-green-600' : 'text-primary'}`}>{pct}%</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tegendoelpunten */}
          {(match.opponent_goals || []).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-black/[.06] p-4">
              <div className="stencil text-ink-500 mb-3">Tegendoelpunten</div>
              <div className="space-y-1.5">
                {(match.opponent_goals || []).map((goal, idx) => {
                  const shotType = SHOT_TYPES.find(t => t.id === goal.type);
                  return (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-black/[.04] last:border-0">
                      <span className="font-semibold text-[13px] text-ink-900 dark:text-white">{goal.concededBy}</span>
                      <span className="stencil text-ink-500">{shotType?.label || 'Onbekend'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Acties */}
          <button
            onClick={async () => {
              try {
                await updateMatchMutation({ matchId: match._id, shareable: true });
                const shareUrl = `${window.location.origin}${window.location.pathname}?match=${match._id}`;
                await navigator.clipboard.writeText(shareUrl);
                showFeedback('Deel-link gekopieerd!', 'success');
              } catch (error) {
                showFeedback(`Fout bij delen: ${error.message || 'Onbekende fout'}`, 'error');
              }
            }}
            className="w-full border border-black/[.08] dark:border-gray-700 bg-white dark:bg-gray-800 text-ink-900 dark:text-white py-3.5 rounded-2xl font-bold text-[14px] hover:border-primary hover:text-primary active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" /> Deel wedstrijd
          </button>

          {currentUserIsAdmin && (
            <button onClick={onDelete}
              className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-700/40 text-primary py-3.5 rounded-2xl font-bold text-[14px] hover:bg-red-100 active:scale-[0.98] transition-all">
              Wedstrijd verwijderen
            </button>
          )}
        </div>
      </div>
    );
  };

  // Views that show the bottom navigation bar
  const bottomNavViews = ['home', 'manage-players', 'statistics'];
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

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <div
          className="fixed inset-0 bg-ink-900/70 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowUpgradeModal(false); }}
        >
          <div className="bg-[#FAFAF7] rounded-t-[24px] sm:rounded-[24px] max-w-sm w-full shadow-sheet overflow-hidden">
            {/* Close + header */}
            <div className="px-5 pt-4 pb-0 flex justify-end">
              <button onClick={() => setShowUpgradeModal(false)}
                className="w-8 h-8 rounded-full bg-white border border-black/[.08] flex items-center justify-center">
                <X className="w-4 h-4 text-ink-500" />
              </button>
            </div>
            <div className="px-5 pb-2">
              <div className="stencil text-[10px] text-primary mb-2">Upgrade</div>
              <h2 className="font-display font-black text-[26px] leading-[0.95] tracking-[-0.03em] text-ink-900 mb-1.5">
                Speel zonder<br/>limieten.
              </h2>
              <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
                Je zit op het gratis plan. Upgrade voor onbeperkte wedstrijden, AI-advies en meer.
              </p>
            </div>
            {/* Plan cards */}
            <div className="px-5 pb-2 space-y-2.5">
              {/* Starter */}
              <div className="relative">
                <div className="absolute -top-2 left-4 bg-amber-500 text-white font-display font-black text-[9px] px-2.5 py-0.5 rounded-full tracking-[0.06em] z-10">
                  POPULAIR
                </div>
                <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-4 text-white">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-display font-black text-[18px] tracking-tight">Starter</div>
                      <div className="text-[11px] text-white/70 mt-0.5">1 team · maandelijks opzegbaar</div>
                    </div>
                    <div className="score-number text-[20px]">€4,99<span className="font-sans font-medium text-[12px] text-white/70">/mo</span></div>
                  </div>
                  <ul className="space-y-1 mb-3">
                    {['Onbeperkte wedstrijden', 'AI trainingsadvies', 'Seizoensbeheer', 'CSV export'].map(f => (
                      <li key={f} className="flex items-center gap-1.5 text-[12px] font-medium text-white/90">
                        <Check className="w-3 h-3 flex-shrink-0" strokeWidth={3} /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => { setShowUpgradeModal(false); showFeedback('Koppel Stripe in de instellingen om te upgraden', 'info'); }}
                    className="w-full bg-white text-primary py-2.5 rounded-xl font-bold text-[13px] active:scale-[0.98] transition-all"
                  >
                    Upgraden naar Starter →
                  </button>
                </div>
              </div>
              {/* Club */}
              <div className="bg-ink-900 rounded-2xl p-4 text-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-display font-black text-[18px] tracking-tight">Club</div>
                    <div className="text-[11px] text-white/55 mt-0.5">Tot 3 teams · voor hele club</div>
                  </div>
                  <div className="score-number text-[20px] text-white/80">€12,99<span className="font-sans font-medium text-[12px] text-white/50">/mo</span></div>
                </div>
                <ul className="space-y-1 mb-3">
                  {['Alles van Starter', 'Centraal cluboverzicht', 'Prioriteit support'].map(f => (
                    <li key={f} className="flex items-center gap-1.5 text-[12px] font-medium text-white/80">
                      <Check className="w-3 h-3 flex-shrink-0" strokeWidth={3} /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => { setShowUpgradeModal(false); showFeedback('Koppel Stripe in de instellingen om te upgraden', 'info'); }}
                  className="w-full bg-white/10 border border-white/15 text-white py-2.5 rounded-xl font-bold text-[13px] active:scale-[0.98] transition-all"
                >
                  Upgraden naar Club →
                </button>
              </div>
            </div>
            <div className="px-5 py-4 text-center">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-[12px] text-gray-400 hover:text-gray-600 transition"
              >
                Later misschien
              </button>
            </div>
          </div>
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
      <SettingsSheet
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        colorTheme={colorTheme}
        setColorTheme={setColorTheme}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        currentTeamId={currentTeamId}
        onFeedback={showFeedback}
        onSwitchTeam={() => { setShowSettings(false); setForcePicker(true); setForceOnboarding(false); }}
        onAddTeam={() => { setShowSettings(false); setForceOnboarding(true); setForcePicker(false); }}
        onUpgrade={() => setShowUpgradeModal(true)}
        subscription={subscription}
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

          // Not logged in → landing page or Clerk auth components
          if (!isAuthenticated) {
            const isLoginPage = authPagePath === '/login';
            const isSignUpPage = authPagePath === '/sign-up';

            // Show landing page for root path
            if (!isLoginPage && !isSignUpPage) {
              return <LandingPage />;
            }

            return (
              <div className="min-h-screen bg-canvas dark:bg-gray-950 flex flex-col">
                {/* Nav */}
                <div className="px-5 h-14 flex items-center justify-between border-b border-black/[.06] dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <KorfbalLogo size={26} variant="red" />
                    <span className="font-display font-black text-[13px] tracking-tight text-ink-900 dark:text-white">Korfbal Score</span>
                  </div>
                  <button
                    onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                    className="text-[12px] font-semibold text-ink-500 hover:text-ink-900 dark:hover:text-white transition"
                  >
                    ← Terug
                  </button>
                </div>
                <div className="flex-1 flex flex-col justify-center px-5 max-w-md mx-auto w-full py-8">
                  <div className="mb-6">
                    <div className="stencil text-primary mb-2">{isSignUpPage ? 'Gratis aanmelden' : 'Welkom terug'}</div>
                    <h1 className="font-display font-black text-[36px] leading-[0.95] tracking-[-0.035em] text-ink-900 dark:text-white">
                      {isSignUpPage ? <>Maak je<br/>account aan.</> : <>Log in en<br/>pak de fluit.</>}
                    </h1>
                  </div>
                  {isSignUpPage ? (
                    <SignUp
                      appearance={{
                        elements: {
                          rootBox: 'w-full',
                          card: 'rounded-2xl border border-black/[.06] shadow-none bg-white',
                          headerTitle: 'hidden',
                          headerSubtitle: 'hidden',
                        }
                      }}
                      signInUrl="/login"
                      afterSignUpUrl="/"
                    />
                  ) : (
                    <SignIn
                      appearance={{
                        elements: {
                          rootBox: 'w-full',
                          card: 'rounded-2xl border border-black/[.06] shadow-none bg-white',
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
                          if (result.isGodMode) { setGodModePassword(pw); setShowGodMode(true); navigateTo('god-mode'); }
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

          // No team yet → onboarding OR team picker requested
          if (!currentTeamId || forceOnboarding || forcePicker) {
            if (userTeams.length === 0 || forceOnboarding) {
              return <OnboardingView />;
            }
            // Explicit picker request (e.g. "Team wisselen") OR 2+ teams
            if (forcePicker || userTeams.length >= 2) {
              return <TeamPickerView />;
            }
            // 1 team → auto-selection useEffect will run immediately; show spinner to avoid flash
            return (
              <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            );
          }

          // Normal authenticated app views
          return (
            <>
              {view === 'home' && <HomeView />}
              {view === 'manage-players' && <ManagePlayersView />}
              {view === 'setup-match' && <SetupMatchView
                currentTeamData={currentTeamData}
                currentTeam={currentTeam}
                opponent={setupOpponent}
                setOpponent={setSetupOpponent}
                selectedPlayers={setupSelectedPlayers}
                setSelectedPlayers={setSetupSelectedPlayers}
                withAttempts={setupWithAttempts}
                setWithAttempts={setSetupWithAttempts}
                matchDate={setupMatchDate}
                setMatchDate={setSetupMatchDate}
                seasons={seasons || []}
                seasonId={setupSeasonId}
                setSeasonId={setSetupSeasonId}
                competition={setupCompetition}
                setCompetition={setSetupCompetition}
                navigateTo={navigateTo}
                handleLogout={handleLogout}
                setCurrentMatch={setCurrentMatch}
                setMatchActionHistory={setMatchActionHistory}
                resetTimer={resetTimer}
                showFeedback={showFeedback}
              />}
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
