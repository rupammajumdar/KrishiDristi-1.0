import React, { useState } from 'react';
import { 
  Building2, 
  Droplets, 
  AlertOctagon, 
  MapPin, 
  Download, 
  ChevronRight, 
  Layers, 
  TrendingDown,
  PieChart as PieIcon,
  CheckCircle2
} from 'lucide-react';
import { translations } from '../i18n';

import { Search, ChevronDown, Sparkles } from 'lucide-react';

export default function GovernmentDashboard({ 
  districtSummary, 
  districtDrilldown, 
  onGenerateReport, 
  currentLang,
  onSelectDistrict
}) {
  const t = translations[currentLang] || translations.en;
  const [selectedTaluk, setSelectedTaluk] = useState(null);
  const [districtSearch, setDistrictSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const POPULAR_DISTRICTS = [
    { district: "Raipur", state: "Chhattisgarh", flag: "🌾" },
    { district: "Jalna", state: "Maharashtra", flag: "🌱" },
    { district: "Pune", state: "Maharashtra", flag: "🍇" },
    { district: "Nagpur", state: "Maharashtra", flag: "🍊" },
    { district: "Bengaluru", state: "Karnataka", flag: "🌿" },
    { district: "Hyderabad", state: "Telangana", flag: "🌾" },
    { district: "Ludhiana", state: "Punjab", flag: "🌾" },
    { district: "Jaipur", state: "Rajasthan", flag: "🌻" },
    { district: "Bhopal", state: "Madhya Pradesh", flag: "🌱" },
  ];

  const summary = districtSummary || {
    district: "Raipur",
    state: "Chhattisgarh",
    total_plots: 1240,
    green_count: 560,
    yellow_count: 430,
    red_count: 250,
    total_water_bodies: 14,
    avg_water_depletion_pct: 21.4,
    active_alerts: 18
  };

  const taluks = districtDrilldown?.taluks || [
    { taluk: `${summary.district} Central`, total_plots: 420, green_count: 210, yellow_count: 140, red_count: 70, avg_ndvi: 0.54, water_bodies: 5 },
    { taluk: `${summary.district} North`, total_plots: 310, green_count: 110, yellow_count: 120, red_count: 80, avg_ndvi: 0.46, water_bodies: 4 },
    { taluk: `${summary.district} South`, total_plots: 290, green_count: 130, yellow_count: 100, red_count: 60, avg_ndvi: 0.48, water_bodies: 3 },
    { taluk: `${summary.district} East`, total_plots: 220, green_count: 110, yellow_count: 70, red_count: 40, avg_ndvi: 0.51, water_bodies: 2 }
  ];

  const handlePickDistrict = (distName) => {
    if (onSelectDistrict) {
      onSelectDistrict(distName);
    }
    setDistrictSearch('');
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── District / State Selector Toolbar ── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-200">
              Macro Jurisdiction / जिल्हा व राज्य निवडा:
            </span>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
            📍 {summary.district}, {summary.state}
          </span>
        </div>

        {/* Quick District Switcher Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {POPULAR_DISTRICTS.map((item) => {
            const isSelected = (summary.district || '').toLowerCase() === item.district.toLowerCase();
            return (
              <button
                key={item.district}
                onClick={() => handlePickDistrict(item.district)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/60 border border-amber-400 scale-[1.03]'
                    : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-800/60'
                }`}
              >
                <span>{item.flag}</span>
                <span>{item.district}</span>
                <span className="text-[10px] font-normal opacity-70">({item.state})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-slate-100">
              {summary.district} District Macro Dashboard ({summary.state})
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Automated Satellite Roll-Up Assessment | 3-Click Drill-down to Village & Plot
          </p>
        </div>

        <button
          onClick={() => onGenerateReport(1, 'government')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-950/50 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{t.government.exportEvidence}</span>
        </button>
      </div>

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Monitored Plots */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 uppercase font-semibold">Total Plots Monitored</span>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{summary.total_plots}</div>
          <span className="text-[11px] text-slate-500 mt-1">100% Satellite Coverage</span>
        </div>

        {/* Severe Stress Plots (Red) */}
        <div className="glass-panel p-4 rounded-2xl border border-rose-900/40 bg-rose-950/20 flex flex-col justify-between">
          <span className="text-xs text-rose-400 uppercase font-semibold">Severe Stress (Red)</span>
          <div className="text-2xl font-bold text-rose-400 mt-2">{summary.red_count}</div>
          <span className="text-[11px] text-rose-300/70 mt-1">
            {((summary.red_count / summary.total_plots) * 100).toFixed(1)}% of District
          </span>
        </div>

        {/* Reservoir Water Surface Depletion */}
        <div className="glass-panel p-4 rounded-2xl border border-cyan-900/40 bg-cyan-950/20 flex flex-col justify-between">
          <span className="text-xs text-cyan-400 uppercase font-semibold">Water Body Depletion</span>
          <div className="text-2xl font-bold text-cyan-300 mt-2">-{summary.avg_water_depletion_pct}%</div>
          <span className="text-[11px] text-cyan-400/70 mt-1">vs 5-Year Baseline ({summary.total_water_bodies} Lakes)</span>
        </div>

        {/* Active Drought Alerts */}
        <div className="glass-panel p-4 rounded-2xl border border-amber-900/40 bg-amber-950/20 flex flex-col justify-between">
          <span className="text-xs text-amber-400 uppercase font-semibold">Active Early Warning Alerts</span>
          <div className="text-2xl font-bold text-amber-300 mt-2">{summary.active_alerts}</div>
          <span className="text-[11px] text-amber-400/70 mt-1">Requires Relief Assessment</span>
        </div>
      </div>

      {/* 3-Click Drill-down Table (District -> Taluk -> Village) */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>Taluk Stress & Reservoir Surface Area Drill-Down</span>
          </h3>
          <span className="text-[11px] text-slate-400">Click a Taluk row to inspect Village details</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold bg-slate-900/60">
                <th className="p-3">Taluk</th>
                <th className="p-3">Total Plots</th>
                <th className="p-3">Green (High)</th>
                <th className="p-3">Yellow (Mod)</th>
                <th className="p-3">Red (Severe)</th>
                <th className="p-3">Avg NDVI</th>
                <th className="p-3">Lakes Monitored</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {taluks.map((tRow) => (
                <tr 
                  key={tRow.taluk}
                  onClick={() => setSelectedTaluk(selectedTaluk === tRow.taluk ? null : tRow.taluk)}
                  className={`hover:bg-slate-900/80 cursor-pointer transition-colors ${
                    selectedTaluk === tRow.taluk ? 'bg-amber-500/10 border-l-4 border-l-amber-500' : ''
                  }`}
                >
                  <td className="p-3 font-bold text-slate-100 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    {tRow.taluk}
                  </td>
                  <td className="p-3 font-mono">{tRow.total_plots}</td>
                  <td className="p-3 font-bold text-emerald-400">{tRow.green_count}</td>
                  <td className="p-3 font-bold text-amber-400">{tRow.yellow_count}</td>
                  <td className="p-3 font-bold text-rose-400">{tRow.red_count}</td>
                  <td className="p-3 font-mono text-cyan-300">{tRow.avg_ndvi}</td>
                  <td className="p-3 font-mono text-slate-300">{tRow.water_bodies}</td>
                  <td className="p-3">
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${selectedTaluk === tRow.taluk ? 'rotate-90 text-amber-400' : ''}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
