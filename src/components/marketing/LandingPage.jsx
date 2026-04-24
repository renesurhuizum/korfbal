import React from 'react';
import { Trophy, BarChart2, Users, Zap, CheckCircle, Star } from 'lucide-react';

const FEATURES = [
  { icon: Trophy, title: 'Live wedstrijden bijhouden', desc: 'Doelpunten, pogingen en wissels per speler in real-time.' },
  { icon: BarChart2, title: 'Statistieken per seizoen', desc: 'W/D/V record, schot%, spelersprestaties en competitie-overzicht.' },
  { icon: Users, title: 'Meerdere coaches', desc: 'Nodig teamgenoten uit via een link — iedereen kan live meekijken en invoeren.' },
  { icon: Zap, title: 'AI trainingsadvies', desc: 'Claude geeft gepersonaliseerd trainingsadvies op basis van jullie wedstrijddata.' },
];

const PLANS = [
  {
    name: 'Gratis',
    price: '€0',
    period: '',
    desc: 'Probeer de app zonder risico',
    features: ['1 team', 'Max. 20 wedstrijden', 'Live score bijhouden', 'Deelbare wedstrijdlinks'],
    cta: 'Gratis beginnen',
    highlight: false,
  },
  {
    name: 'Starter',
    price: '€4,99',
    period: '/maand',
    desc: 'Voor serieuze teams',
    features: ['1 team', 'Onbeperkte wedstrijden', 'AI trainingsadvies', 'Seizoensbeheer', 'CSV export'],
    cta: 'Start Starter',
    highlight: true,
  },
  {
    name: 'Club',
    price: '€12,99',
    period: '/maand',
    desc: 'Voor clubs met meerdere teams',
    features: ['Tot 3 teams', 'Alles van Starter', 'Centraal cluboverzicht', 'Prioriteit support'],
    cta: 'Start Club',
    highlight: false,
  },
];

export function LandingPage() {
  const goToLogin = () => {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const goToSignUp = () => {
    window.history.pushState({}, '', '/sign-up');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-primary">
            <Trophy className="w-5 h-5" />
            <span>Korfbal Score</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToLogin}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary transition"
            >
              Inloggen
            </button>
            <button
              onClick={goToSignUp}
              className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition"
            >
              Gratis beginnen
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-3 py-1 rounded-full mb-6">
          <Star className="w-3.5 h-3.5" /> Gebouwd door korfballers, voor korfballers
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
          Bijhouden wat écht telt<br className="hidden sm:block" /> op het veld
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-8">
          Korfbal Score is de eenvoudigste manier om wedstrijdstatistieken bij te houden — live, per speler, per schotttype.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={goToSignUp}
            className="px-6 py-3 bg-primary text-white font-semibold rounded-xl shadow-lg hover:bg-primary-dark transition text-base"
          >
            Gratis beginnen — geen creditcard nodig
          </button>
          <button
            onClick={goToLogin}
            className="px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:border-primary hover:text-primary transition text-base"
          >
            Al een account? Inloggen →
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 dark:bg-gray-900 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-10">Alles wat je team nodig heeft</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white dark:bg-gray-800 rounded-2xl p-6 flex gap-4 shadow-sm">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-2">Eenvoudige prijzen</h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-10 text-sm">Geen verborgen kosten. Maandelijks opzegbaar.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 flex flex-col border-2 transition ${
                plan.highlight
                  ? 'border-primary shadow-xl shadow-primary/10 bg-primary/5 dark:bg-primary/10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              {plan.highlight && (
                <div className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Meest gekozen</div>
              )}
              <div className="mb-1 text-xl font-bold">{plan.name}</div>
              <div className="mb-1">
                <span className="text-3xl font-extrabold">{plan.price}</span>
                <span className="text-gray-400 text-sm">{plan.period}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{plan.desc}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={goToSignUp}
                className={`w-full py-2.5 rounded-xl font-semibold text-sm transition ${
                  plan.highlight
                    ? 'bg-primary text-white hover:bg-primary-dark'
                    : 'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-gray-800 py-8 text-center text-sm text-gray-400">
        <p>© 2026 Korfbal Score App · <a href="/privacy" className="hover:text-primary transition">Privacybeleid</a></p>
      </footer>
    </div>
  );
}
