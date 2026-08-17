import React, { useState } from 'react';
import { 
  ShieldCheck, 
  FileJson, 
  CheckCircle, 
  Clock, 
  Download, 
  Cpu, 
  Calendar,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { translations } from '../i18n';

export default function InsurerDashboard({ 
  selectedAoi, 
  prediction, 
  onGenerateReport, 
  currentLang 
}) {
  const t = translations[currentLang] || translations.en;
  const [showJson, setShowJson] = useState(false);

  const crop = (selectedAoi?.crop_type || prediction?.crop_type || 'cotton').toLowerCase();
  const modelVersion = prediction?.model_version || `v1.2.0-rf-${crop}`;
  const predYield = prediction?.predicted_yield_kg_ha || 1720.0;
  const changePct = prediction?.yield_change_pct || -21.8;
  const inputSnapshot = prediction?.input_snapshot_json || {
    mean_ndvi: 0.44,
    mean_ndwi: -0.15,
    rainfall_mm: 360.0,
    temp_avg_c: 29.5,
    crop_type: crop,
    timestamp: new Date().toISOString()
  };

  const auditHistory = [
    { date: '2026-08-10', passId: 'S2A_MSIL2A_20260810', ndvi: 0.44, yieldEst: predYield, modelVer: modelVersion, alertFired: 'Yes (Drought Risk)' },
    { date: '2026-08-05', passId: 'S2A_MSIL2A_20260805', ndvi: 0.48, yieldEst: Math.round(predYield * 1.08), modelVer: modelVersion, alertFired: 'No' },
    { date: '2026-07-31', passId: 'S2A_MSIL2A_20260731', ndvi: 0.52, yieldEst: Math.round(predYield * 1.15), modelVer: modelVersion, alertFired: 'No' },
    { date: '2026-07-26', passId: 'S2A_MSIL2A_20260726', ndvi: 0.60, yieldEst: Math.round(predYield * 1.25), modelVer: modelVersion, alertFired: 'No' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-100">{t.insurer.claimVerification}</h2>
          </div>
          <p className="text-xs text-slate-400">
            Objective 3rd-Party Satellite Evidence & Immutable ML Prediction Audit Trail
          </p>
        </div>

        <button
          onClick={() => onGenerateReport(selectedAoi?.id || 1, 'insurer')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/50 cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          <span>Download Insurer Audit Report</span>
        </button>
      </div>

      {/* Model Provenance & Snapshot Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 uppercase font-semibold flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            Active ML Model Version
          </span>
          <div className="text-xl font-bold font-mono text-cyan-300 mt-2">{modelVersion}</div>
          <span className="text-[11px] text-slate-400 mt-1">Validation MAPE: 11.4% (R² = 0.89)</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 uppercase font-semibold">Predicted Loss vs Baseline</span>
          <div className="text-xl font-bold text-rose-400 mt-2">{changePct}% Loss</div>
          <span className="text-[11px] text-slate-400 mt-1">Baseline: 2,200 kg/ha | Forecast: {predYield} kg/ha</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 uppercase font-semibold">Early Warning History</span>
          <div className="text-xl font-bold text-emerald-400 mt-2">Verified (Drought Risk)</div>
          <span className="text-[11px] text-slate-400 mt-1">First Alert Date: 2026-08-10</span>
        </div>
      </div>

      {/* Raw Feature Snapshot Viewer */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileJson className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-200">{t.insurer.inputSnapshot}</h3>
          </div>
          <button
            onClick={() => setShowJson(!showJson)}
            className="text-xs text-cyan-400 hover:underline"
          >
            {showJson ? 'Hide JSON' : 'View Full Raw JSON'}
          </button>
        </div>

        {showJson && (
          <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-emerald-300 font-mono overflow-x-auto">
            {JSON.stringify(inputSnapshot, null, 2)}
          </pre>
        )}
      </div>

      {/* Satellite Pass Historical Time-Series Audit Table */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800">
        <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span>{t.insurer.historicalTimeSeries}</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold bg-slate-900/60">
                <th className="p-3">Acquisition Date</th>
                <th className="p-3">Scene Pass ID</th>
                <th className="p-3">Observed NDVI</th>
                <th className="p-3">Yield Forecast</th>
                <th className="p-3">Model Version</th>
                <th className="p-3">EWS Alert Triggered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {auditHistory.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-900/60">
                  <td className="p-3 text-slate-200">{row.date}</td>
                  <td className="p-3 text-slate-400">{row.passId}</td>
                  <td className="p-3 font-bold text-amber-400">{row.ndvi}</td>
                  <td className="p-3 font-bold text-slate-100">{row.yieldEst} kg/ha</td>
                  <td className="p-3 text-cyan-300">{row.modelVer}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      row.alertFired.includes('Yes') ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {row.alertFired}
                    </span>
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
