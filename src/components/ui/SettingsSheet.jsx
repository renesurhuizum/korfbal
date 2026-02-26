import React, { useState, useEffect, useRef } from 'react';
import { X, Moon, Sun, Users, Link, Trash2, Crown, User } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { useClerk } from '@clerk/clerk-react';
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
 * Sections: color theme, dark mode, team members, account, app info.
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
  const [copySuccess, setCopySuccess] = useState(false);
  const { openUserProfile } = useClerk();

  // Convex queries + mutations
  const teamMembers = useQuery(
    api.memberships.getTeamMembers,
    currentTeamId ? { teamId: currentTeamId } : 'skip'
  );
  const generateInviteMutation = useMutation(api.memberships.generateInvite);
  const removeMemberMutation = useMutation(api.memberships.removeMember);

  // Is current user an admin of this team?
  const currentUserIsAdmin = teamMembers?.some(m => m.isCurrentUser && m.role === 'admin');

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
    setTimeout(() => sheetRef.current?.querySelector('[data-close]')?.focus(), 50);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleGenerateInvite = async () => {
    try {
      const { token } = await generateInviteMutation({ teamId: currentTeamId });
      const url = `${window.location.origin}?invite=${token}`;
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
      onFeedback('Uitnodigingslink gekopieerd!', 'success');
    } catch (e) {
      onFeedback(e.message || 'Fout bij genereren link', 'error');
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await removeMemberMutation({ teamId: currentTeamId, targetUserId: userId });
      onFeedback('Lid verwijderd', 'success');
    } catch (e) {
      onFeedback(e.message || 'Fout bij verwijderen lid', 'error');
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

          {/* Section: Teamleden */}
          {currentTeamId && (
            <section>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" /> Teamleden
              </h3>

              {/* Member list */}
              {teamMembers === undefined ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Laden...</p>
              ) : teamMembers.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Geen leden gevonden</p>
              ) : (
                <ul className="space-y-1 mb-3">
                  {teamMembers.map((m) => (
                    <li key={m.userId} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2.5">
                        {m.role === 'admin'
                          ? <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                          : <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        }
                        <div>
                          <span className="text-sm text-gray-800 dark:text-gray-100">
                            {m.displayName}
                            {m.isCurrentUser && <span className="ml-1.5 text-xs text-gray-400">(jij)</span>}
                          </span>
                          <div className="text-xs text-gray-400">
                            {m.role === 'admin' ? 'Beheerder' : 'Lid'}
                          </div>
                        </div>
                      </div>
                      {currentUserIsAdmin && !m.isCurrentUser && (
                        <button
                          onClick={() => handleRemoveMember(m.userId)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          aria-label={`Verwijder ${m.displayName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Invite link — admin only */}
              {currentUserIsAdmin && (
                <button
                  onClick={handleGenerateInvite}
                  className={`flex items-center gap-2 w-full px-4 py-2.5 rounded-lg border-2 transition text-sm font-medium ${
                    copySuccess
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'border-primary text-primary hover:bg-primary hover:text-white'
                  }`}
                >
                  <Link className="w-4 h-4" />
                  {copySuccess ? 'Gekopieerd! ✓' : 'Kopieer uitnodigingslink (7 dagen geldig)'}
                </button>
              )}
            </section>
          )}

          {/* Section: Account */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Account
            </h3>
            <button
              onClick={() => { openUserProfile(); onClose(); }}
              className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm text-gray-700 dark:text-gray-300"
            >
              Profiel &amp; wachtwoord wijzigen →
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Via Clerk accountbeheer</p>
          </section>

          {/* Section: Over de app */}
          <section className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Over de app
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Korfbal Score App v2.0</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Bijhouden van korfbalstatistieken</p>
          </section>
        </div>
      </div>
    </div>
  );
}
