import React from 'react';
import { 
  Sprout, 
  Building2, 
  ShieldCheck, 
  Settings, 
  Globe, 
  Bell, 
  Layers, 
  Sparkles,
  Calendar,
  FileText
} from 'lucide-react';
import { translations } from '../i18n';

export default function Header({ 
  currentPersona, 
  onSelectPersona, 
  currentLang, 
  onSelectLang, 
  alertCount, 
  onToggleNotifications,
  onOpenAdmin 
}) {
  const t = translations[currentLang] || translations.en;

  const personas = [
    { id: 'farmer', name: t.personas.farmer, icon: Sprout, color: 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10' },
    { id: 'government', name: t.personas.government, icon: Building2, color: 'text-amber-400 border-amber-500/50 bg-amber-500/10' },
    { id: 'insurer', name: t.personas.insurer, icon: ShieldCheck, color: 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10' },
  ];

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'kn', label: 'ಕನ್ನಡ' },
    { code: 'te', label: 'తెలుగు' },
    { code: 'mr', label: 'मराठी' },
  ];

  return (
    <header className="glass-panel sticky top-0 z-50 px-4 py-3 border-b border-slate-800 flex items-center justify-between shadow-2xl">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-green-400 p-[2px] shadow-lg shadow-emerald-900/40">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Sprout className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-green-200 bg-clip-text text-transparent tracking-tight">
              {t.appTitle}
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              v4.0 MVP
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            {t.subTitle}
          </p>
        </div>
      </div>

      {/* Persona Selector Tabs (User Facing Only) */}
      <div className="hidden lg:flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
        {personas.map((p) => {
          const Icon = p.icon;
          const isActive = currentPersona === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelectPersona(p.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                isActive
                  ? `${p.color} border shadow-md font-semibold`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>

      {/* Right Tools, Admin Access & Language Switcher */}
      <div className="flex items-center gap-3">
        {/* Mobile Persona Switcher */}
        <select
          value={currentPersona}
          onChange={(e) => onSelectPersona(e.target.value)}
          className="lg:hidden bg-slate-900 text-xs border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
        >
          {personas.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Dedicated Admin Portal Switch Button */}
        <button
          onClick={onOpenAdmin}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-300 hover:bg-purple-900/90 hover:border-purple-400 text-xs font-bold transition-all shadow-md shadow-purple-950/50 cursor-pointer"
          title="Switch to Dedicated Admin Ops Portal"
        >
          <Settings className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden md:inline">Admin Portal</span>
        </button>

        {/* Language Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
          <Globe className="w-4 h-4 text-emerald-400" />
          <select
            value={currentLang}
            onChange={(e) => onSelectLang(e.target.value)}
            className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
          >
            {languages.map(l => (
              <option key={l.code} value={l.code} className="bg-slate-900 text-slate-200">
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Notification Bell Badge */}
        <button
          onClick={onToggleNotifications}
          className="relative p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-400 transition-colors"
          title="Early Warning Alert Center"
        >
          <Bell className="w-5 h-5" />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce shadow-md">
              {alertCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
