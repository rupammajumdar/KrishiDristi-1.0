import React, { useState } from 'react';
import { Sparkles, BarChart2, Info, HelpCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { translations } from '../i18n';

export default function ExplainabilityPanel({ prediction, currentLang }) {
  const [viewMode, setViewMode] = useState('farmer'); // farmer vs technical

  const featureImportance = prediction?.feature_importance || {
    "NDVI (Vegetation Index)": 0.45,
    "Seasonal Rainfall (mm)": 0.28,
    "NDWI (Water Balance)": 0.17,
    "Avg Temperature (°C)": 0.10
  };

  const chartData = Object.entries(featureImportance).map(([key, val]) => ({
    name: key,
    value: Math.round(val * 100)
  }));

  const colors = ['#22c55e', '#38bdf8', '#eab308', '#ec4899'];

  return (
    <div className="glass-panel rounded-2xl p-4 border border-emerald-500/30 bg-emerald-950/20 shadow-2xl animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-3 border-b border-emerald-500/20 pb-2">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
          <Sparkles className="w-4 h-4" />
          <span>Explainable AI (XAI) Model Feature Breakdown (F3.3)</span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center p-0.5 bg-slate-900 rounded-lg border border-slate-800 text-[11px]">
          <button
            onClick={() => setViewMode('farmer')}
            className={`px-2.5 py-1 rounded font-medium ${
              viewMode === 'farmer' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Farmer Mode
          </button>
          <button
            onClick={() => setViewMode('technical')}
            className={`px-2.5 py-1 rounded font-medium ${
              viewMode === 'technical' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Technical (SHAP)
          </button>
        </div>
      </div>

      {viewMode === 'farmer' ? (
        <div className="text-xs text-slate-200 space-y-2">
          <p className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 leading-relaxed">
            <b className="text-emerald-400">Primary Factor (45% Weight):</b> Low NDVI readings in weeks 6-8 indicate early leaf yellowing and moisture stress.
          </p>
          <p className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 leading-relaxed">
            <b className="text-cyan-400">Secondary Factor (28% Weight):</b> Local rainfall in Jalna taluk was 32% below the 5-year average over the last 30 days.
          </p>
        </div>
      ) : (
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20 }}>
              <XAxis type="number" unit="%" stroke="#64748b" fontSize={10} />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={130} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
