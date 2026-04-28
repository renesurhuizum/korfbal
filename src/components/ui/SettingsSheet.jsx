import React, { useState, useEffect, useRef } from 'react';
import { X, Moon, Sun, Users, Link, Trash2, Crown, User, RefreshCw, Plus, Zap, AlertTriangle, Check } from 'lucide-react';
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

export function SettingsSheet({
  isOpen,
  onClose,
  colorTheme,
  setColorTheme,
  darkMode,
  toggleDarkMode,
  currentTeamId,
  onFeedback,
  onSwitchTeam,
  onAddTeam,
  onUpgrade,
  subscription,
}) {
  const sheetRef = useRef(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const { openUserProfile } = useClerk();

  const teamMembers = useQuery(
    api.memberships.getTeamMembers,
    currentTeamId ? { teamId: currentTeamId } : 'skip'
  );
  const generateInviteMutation = useMutation(api.memberships.generateInvite);
  const removeMemberMutation = useMutation(api.memberships.removeMember);
  const updateTeamThemeMutation = useMutation(api.teams.updateTeamTheme);
  const deleteSelfMutation = useMutation(api.memberships.deleteSelfAndData);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const currentUserIsAdmin = teamMembers?.some(m => m.isCurrentUser && m.role === 'admin');

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
    setIsGeneratingInvite(true);
    try {
      const { token } = await generateInviteMutation({ teamId: currentTeamId });
      const url = `${window.location.origin}?invite=${token}`;
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
      onFeedback('Uitnodigingslink gekopieerd!', 'success');
    } catch (e) {
      onFeedback(e.message || 'Fout bij genereren uitnodigingslink', 'error');
    } finally {
      setIsGeneratingInvite(false);
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

  const handleDeleteAccount = async () => {
    try {
      await deleteSelfMutation({});
      onFeedback('Account en data verwijderd', 'success');
      onClose();
    } catch (e) {
      onFeedback(e.message || 'Fout bij verwijderen account', 'error');
    }
    setShowDeleteConfirm(false);
  };

  if (!isOpen) return null;

  const planName = subscription?.status === 'starter' ? 'Starter' : subscription?.status === 'club' ? 'Club' : 'Gratis';
  const isPaid = subscription?.status === 'starter' || subscription?.status === 'club';

  return (
    <div
      className="fixed inset-0 bg-ink-900/50 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Instellingen"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={sheetRef}
        className="bg-white dark:bg-gray-900 rounded-t-[24px] sm:rounded-[24px] w-full sm:max-w-md max-h-[90vh] overflow-y-auto shadow-[-0px_-20px_40px_rgba(0,0,0,0.12)]"
      >
        {/* Drag handle */}
        <div className="pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-black/10 dark:bg-white/10 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="font-display font-black text-[24px] tracking-tight dark:text-white">Instellingen</h2>
          <button
            data-close
            onClick={onClose}
            className="w-9 h-9 bg-[#FAFAF7] dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            aria-label="Sluiten"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-8 space-y-6">

          {/* Section: Kleurthema */}
          <section>
            <div className="stencil text-[10px] text-gray-400 mb-3">Team kleur</div>
            <div className="flex gap-3 flex-wrap">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setColorTheme(t.id);
                    if (currentTeamId) {
                      updateTeamThemeMutation({ teamId: currentTeamId, theme: t.id });
                    }
                  }}
                  aria-pressed={colorTheme === t.id}
                  aria-label={`Thema: ${t.label}`}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    style={{ backgroundColor: t.color, outlineColor: colorTheme === t.id ? t.color : 'transparent' }}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${
                      colorTheme === t.id
                        ? 'outline outline-2 outline-offset-2 shadow-md'
                        : ''
                    }`}
                  >
                    {colorTheme === t.id && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                  </span>
                  <span className={`text-[11px] font-medium ${colorTheme === t.id ? 'text-gray-800 dark:text-gray-100 font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Section: Weergave */}
          <section>
            <div className="stencil text-[10px] text-gray-400 mb-3">Weergave</div>
            <div className="flex items-center justify-between py-2.5 px-4 bg-[#FAFAF7] dark:bg-gray-800 rounded-2xl">
              <div className="flex items-center gap-3">
                {darkMode
                  ? <Moon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  : <Sun className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                }
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {darkMode ? 'Donkere modus' : 'Lichte modus'}
                </span>
              </div>
              <button
                role="switch"
                aria-checked={darkMode}
                onClick={toggleDarkMode}
                aria-label="Donkere modus"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  darkMode ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow transform transition-transform ${
                    darkMode ? 'translate-x-5' : 'translate-x-1'
                  }`}
                  style={{ width: 18, height: 18 }}
                />
              </button>
            </div>
          </section>

          {/* Section: Teamleden */}
          {currentTeamId && (
            <section>
              <div className="stencil text-[10px] text-gray-400 mb-3">Teamleden</div>

              {teamMembers === undefined ? (
                <p className="text-sm text-gray-400">Laden...</p>
              ) : teamMembers.length === 0 ? (
                <p className="text-sm text-gray-400">Geen leden gevonden</p>
              ) : (
                <ul className="space-y-1.5 mb-3">
                  {teamMembers.map((m) => (
                    <li key={m.userId} className="flex items-center justify-between py-2 px-3.5 bg-[#FAFAF7] dark:bg-gray-800 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          m.role === 'admin' ? 'bg-gold-400/20' : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          {m.role === 'admin'
                            ? <Crown className="w-3.5 h-3.5 text-gold-500" />
                            : <User className="w-3.5 h-3.5 text-gray-400" />
                          }
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            {m.displayName}
                            {m.isCurrentUser && <span className="ml-1.5 text-xs text-gray-400 font-normal">(jij)</span>}
                          </span>
                          <div className="text-[11px] text-gray-400">
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
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {currentUserIsAdmin && (
                <button
                  onClick={handleGenerateInvite}
                  disabled={isGeneratingInvite}
                  className={`flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border transition text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed ${
                    copySuccess
                      ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'border-primary/30 text-primary hover:bg-primary hover:text-white hover:border-primary'
                  }`}
                >
                  {isGeneratingInvite
                    ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Aanmaken…</>
                    : copySuccess
                    ? <><Link className="w-4 h-4" /> Gekopieerd! ✓</>
                    : <><Link className="w-4 h-4" /> Kopieer uitnodigingslink (7 dagen)</>
                  }
                </button>
              )}
            </section>
          )}

          {/* Section: Teams */}
          <section>
            <div className="stencil text-[10px] text-gray-400 mb-3">Teams</div>
            <div className="space-y-2">
              {onSwitchTeam && (
                <button
                  onClick={onSwitchTeam}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-black/[.08] dark:border-gray-700 hover:border-primary hover:text-primary bg-white dark:bg-gray-800 transition text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  <RefreshCw className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  Team wisselen
                </button>
              )}
              {onAddTeam && (
                <button
                  onClick={onAddTeam}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-black/[.08] dark:border-gray-700 hover:border-primary hover:text-primary bg-white dark:bg-gray-800 transition text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  Team toevoegen
                </button>
              )}
            </div>
          </section>

          {/* Section: Abonnement */}
          {currentTeamId && (
            <section>
              <div className="stencil text-[10px] text-gray-400 mb-3">Abonnement</div>
              <div className={`rounded-2xl p-4 relative overflow-hidden ${isPaid ? 'bg-ink-900' : 'bg-[#FAFAF7] dark:bg-gray-800 border border-black/[.06] dark:border-gray-700'}`}>
                {isPaid && <div className="field-pattern absolute inset-0 opacity-40" />}
                <div className="relative flex items-start justify-between">
                  <div>
                    <div className={`font-display font-black text-[20px] tracking-tight ${isPaid ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                      {planName}
                    </div>
                    {subscription?.status === 'free' && (
                      <p className="stencil text-gray-400 dark:text-gray-500 mt-1">Max. 20 wedstrijden</p>
                    )}
                    {subscription?.cancelAtPeriodEnd && (
                      <p className={`text-xs mt-0.5 ${isPaid ? 'text-white/60' : 'text-amber-500'}`}>
                        Loopt af aan einde periode
                      </p>
                    )}
                  </div>
                  {isPaid && <Zap className="w-5 h-5 text-primary" />}
                </div>
                {subscription?.status === 'free' && onUpgrade && (
                  <button
                    onClick={() => { onUpgrade(); onClose(); }}
                    className="relative mt-3 flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition w-full justify-center"
                  >
                    <Zap className="w-3.5 h-3.5" /> Upgraden naar Starter
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Section: Account */}
          <section>
            <div className="stencil text-[10px] text-gray-400 mb-3">Account</div>
            <div className="space-y-2">
              <button
                onClick={() => { openUserProfile(); onClose(); }}
                className="w-full text-left px-4 py-3 rounded-xl border border-black/[.08] dark:border-gray-700 hover:border-primary hover:text-primary bg-white dark:bg-gray-800 transition text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Profiel &amp; wachtwoord wijzigen →
              </button>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-red-100 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-sm font-medium flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4 flex-shrink-0" />
                  Account + alle data verwijderen
                </button>
              ) : (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Dit verwijdert je account en <strong>alle wedstrijddata</strong> van teams waar jij de enige beheerder bent. Niet terug te draaien.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition"
                    >
                      Ja, alles verwijderen
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2.5 border border-black/[.1] dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      Annuleren
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Section: Over de app */}
          <section className="border-t border-black/[.06] dark:border-gray-700 pt-5">
            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Korfbal Score App v2.0</p>
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">Gebouwd voor Nederlandse korfbalcoaches</p>
          </section>

        </div>
      </div>
    </div>
  );
}
