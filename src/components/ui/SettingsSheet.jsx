import React, { useState, useEffect, useRef } from 'react';
import { X, Moon, Sun, Eye, EyeOff } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';

const THEMES = [
  { id: 'red',    color: '#dc2626', label: 'Rood' },
  { id: 'orange', color: '#ea580c', label: 'Oranje' },
  { id: 'blue',   color: '#2563eb', label: 'Blauw' },
  { id: 'green',  color: '#16a34a', label: 'Groen' },
  { id: 'purple', color: '#7c3aed', label: 'Paars' },
];

/**
 * Settings bottom sheet.
 * Sections: color theme, dark mode, change password, app info.
 */
export function SettingsSheet({
  isOpen,
  onClose,
  colorTheme,
  setColorTheme,
  darkMode,
  toggleDarkMode,
  currentTeamId,
  onFeedback,
}) {
  const sheetRef = useRef(null);

  // Password change form state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const changePassword = useMutation(api.auth.changePassword);

  // Focus trap + Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const focusable = sheetRef.current?.querySelectorAll(
          'button, input, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    // Focus the close button on open
    setTimeout(() => sheetRef.current?.querySelector('[data-close]')?.focus(), 50);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Clear form when closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setShowCurrentPw(false); setShowNewPw(false);
    }
  }, [isOpen]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      onFeedback('Nieuwe wachtwoorden komen niet overeen', 'error');
      return;
    }
    if (newPw.length < 3) {
      onFeedback('Nieuw wachtwoord moet minimaal 3 tekens zijn', 'error');
      return;
    }
    setPwLoading(true);
    try {
      await changePassword({ teamId: currentTeamId, currentPassword: currentPw, newPassword: newPw });
      onFeedback('Wachtwoord succesvol gewijzigd', 'success');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      onFeedback(err.message || 'Fout bij wijzigen wachtwoord', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Instellingen"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={sheetRef}
        className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Instellingen</h2>
          <button
            data-close
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-500 dark:text-gray-400"
            aria-label="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Section: Kleurthema */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Kleurthema
            </h3>
            <div className="flex gap-3 flex-wrap">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setColorTheme(t.id)}
                  aria-pressed={colorTheme === t.id}
                  aria-label={`Thema: ${t.label}`}
                  className="flex flex-col items-center gap-1"
                >
                  <span
                    style={{ backgroundColor: t.color }}
                    className={`w-10 h-10 rounded-full border-4 transition-transform hover:scale-110 active:scale-95 ${
                      colorTheme === t.id
                        ? 'border-gray-800 dark:border-white scale-110 shadow-lg'
                        : 'border-transparent'
                    }`}
                  />
                  <span className={`text-xs ${colorTheme === t.id ? 'font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Section: Weergave */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Weergave
            </h3>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                {darkMode ? <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" /> : <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
                <span className="text-gray-800 dark:text-gray-100 font-medium">
                  {darkMode ? 'Donkere modus' : 'Lichte modus'}
                </span>
              </div>
              {/* Toggle pill */}
              <button
                role="switch"
                aria-checked={darkMode}
                onClick={toggleDarkMode}
                aria-label="Donkere modus"
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  darkMode ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                    darkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Section: Beveiliging */}
          {currentTeamId && (
            <section>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Beveiliging
              </h3>
              <form onSubmit={handleChangePassword} className="space-y-3">
                {/* Current password */}
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    placeholder="Huidig wachtwoord"
                    autoComplete="current-password"
                    required
                    className="w-full pr-10 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label={showCurrentPw ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* New password */}
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="Nieuw wachtwoord"
                    autoComplete="new-password"
                    required
                    className="w-full pr-10 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label={showNewPw ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Confirm new password */}
                <input
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Herhaal nieuw wachtwoord"
                  autoComplete="new-password"
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />

                <button
                  type="submit"
                  disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                  className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pwLoading ? 'Bezig...' : 'Wachtwoord wijzigen'}
                </button>
              </form>
            </section>
          )}

          {/* Section: Over de app */}
          <section className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Over de app
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Korfbal Score App v1.0</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Bijhouden van korfbalstatistieken</p>
          </section>
        </div>
      </div>
    </div>
  );
}
