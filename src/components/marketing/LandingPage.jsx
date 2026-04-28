import React from 'react';
import { CheckCircle } from 'lucide-react';

const FEATURES = [
  { n: '01', title: 'Live scoren in één tik', desc: 'Tap een speler, kies schottype. Klaar. Ook in de regen, met handschoenen.' },
  { n: '02', title: 'Statistieken die kloppen', desc: 'Schotpercentage per type, per speler, per seizoen. Geen Excel meer.' },
  { n: '03', title: 'Volg je club live', desc: 'Een pagina per club met alle lopende wedstrijden. Deel de link met supporters.' },
  { n: '04', title: 'AI-coach op zondagavond', desc: 'Concrete trainingsadviezen gebaseerd op jullie eigen wedstrijddata.' },
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
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-gray-950 text-ink-900 dark:text-gray-100">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#FAFAF7]/90 dark:bg-gray-950/90 backdrop-blur border-b border-black/[.06] dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-white font-display font-black text-sm">K</div>
            <span className="font-display font-black text-sm tracking-tight dark:text-white">Korfbal Score</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToLogin}
              className="px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-primary transition"
            >
              Inloggen
            </button>
            <button
              onClick={goToSignUp}
              className="px-3 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary-dark transition"
            >
              Gratis beginnen
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-5">

        {/* Hero */}
        <section className="pt-10 pb-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-gray-800 border border-black/[.08] dark:border-gray-700 text-[10px] font-semibold tracking-wide uppercase mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Nu ook: AI coaching
          </div>
          <h1 className="font-display font-black text-[42px] leading-[0.95] tracking-[-0.035em] mb-4 dark:text-white">
            Bijhouden<br />
            wat <em className="text-primary not-italic">écht</em><br />
            telt op<br />
            het veld.
          </h1>
          <p className="text-[15px] leading-relaxed text-gray-500 dark:text-gray-400 mb-5 max-w-sm">
            De scoring-app voor Nederlandse korfbalcoaches. Live wedstrijden, schotstatistieken, en AI-advies na elke match.
          </p>
          <div className="flex gap-2">
            <button
              onClick={goToSignUp}
              className="px-5 py-3 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary-dark transition"
            >
              Start gratis →
            </button>
            <button
              onClick={goToLogin}
              className="px-5 py-3 border border-black/[.12] dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-sm rounded-xl hover:border-primary hover:text-primary transition"
            >
              Inloggen
            </button>
          </div>
        </section>

        {/* Live scoreboard mockup */}
        <section className="mb-10">
          <div className="bg-ink-900 rounded-[18px] p-5 relative overflow-hidden">
            <div className="field-pattern absolute inset-0 opacity-60" />
            <div className="relative">
              <div className="flex justify-between items-center mb-3.5">
                <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/60">Live · 2e helft</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 pulse-ring" />
                  <span className="text-[11px] font-bold text-red-300">LIVE</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3.5 mb-4">
                <div className="flex-1">
                  <div className="text-[11px] font-bold text-white/70 mb-1">Klimop B1</div>
                  <div className="score-number text-[64px] text-white">12</div>
                </div>
                <div className="text-[28px] font-light text-white/30 font-display">–</div>
                <div className="flex-1 text-right">
                  <div className="text-[11px] font-bold text-white/70 mb-1">DKOD</div>
                  <div className="score-number text-[64px] text-white/55">09</div>
                </div>
              </div>
              <div className="pt-3.5 border-t border-white/10 flex gap-4 text-[11px] font-medium text-white/80">
                <div><span className="tabular">34:12</span> <span className="text-white/50">speeltijd</span></div>
                <div><span className="tabular">67%</span> <span className="text-white/50">schot%</span></div>
                <div className="text-green-300">W W G W V</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features lijst */}
        <section className="mb-10">
          <div className="stencil text-[10px] text-primary mb-3.5">Wat je krijgt</div>
          {FEATURES.map((f) => (
            <div key={f.n} className="py-4 border-t border-black/[.08] dark:border-gray-700 flex gap-3.5">
              <div className="display text-[22px] text-primary min-w-[30px] font-black">{f.n}</div>
              <div>
                <div className="font-bold text-[15px] mb-1 tracking-tight dark:text-white">{f.title}</div>
                <div className="text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">{f.desc}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Prijzen */}
        <section className="mb-10">
          <div className="stencil text-[10px] text-gray-400 mb-3">Abonnementen</div>
          <h2 className="font-display font-black text-2xl tracking-tight mb-6 dark:text-white">Eenvoudige prijzen.</h2>
          <div className="flex flex-col gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-5 flex flex-col border transition ${
                  plan.highlight
                    ? 'border-primary shadow-lg shadow-primary/10 bg-primary/5 dark:bg-primary/10'
                    : 'border-black/[.06] dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {plan.highlight && (
                      <div className="stencil text-[9px] text-primary mb-1">Meest gekozen</div>
                    )}
                    <div className="font-display font-black text-lg tracking-tight dark:text-white">{plan.name}</div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{plan.desc}</div>
                  </div>
                  <div className="text-right">
                    <span className="score-number text-[28px] text-ink-900 dark:text-white">{plan.price}</span>
                    <span className="text-gray-400 text-xs">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={goToSignUp}
                  className={`w-full py-2.5 rounded-xl font-semibold text-sm transition ${
                    plan.highlight
                      ? 'bg-primary text-white hover:bg-primary-dark'
                      : 'border border-black/[.1] dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* CTA sectie */}
        <section className="mb-10">
          <div className="bg-primary rounded-[20px] p-6 text-white relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full border-[3px] border-white/15" />
            <div className="absolute right-2 top-2 w-20 h-20 rounded-full border-[3px] border-white/15" />
            <div className="relative">
              <div className="stencil text-[10px] text-white/70 mb-2.5">Gebouwd door korfballers</div>
              <div className="font-display font-black text-[26px] leading-[1.05] tracking-tight mb-4">
                Begin je<br />volgende<br />wedstrijd —<br />gratis.
              </div>
              <button
                onClick={goToSignUp}
                className="bg-white text-ink-900 font-bold text-sm px-4 py-3 rounded-xl hover:bg-gray-50 transition"
              >
                Maak account →
              </button>
            </div>
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer className="border-t border-black/[.06] dark:border-gray-800 py-6 text-center text-[11px] font-medium text-gray-400">
        © 2026 Korfbal Score ·{' '}
        <a href="/privacy" className="text-primary hover:underline">Privacybeleid</a>
      </footer>
    </div>
  );
}
