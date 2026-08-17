import React, { useState } from 'react';
import { 
  Settings, 
  Activity, 
  Cpu, 
  RotateCcw, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Database,
  Layers
} from 'lucide-react';
import { translations } from '../i18n';

export default function AdminConsole({ 
  pipelineStatus, 
  modelRegistry, 
  onRollbackModel, 
  currentLang 
}) {
  const t = translations[currentLang] || translations.en;
  const [activeVersion, setActiveVersion] = useState('v1.2.0-rf-cotton');
  const [rollbackStatus, setRollbackStatus] = useState(null);

  const status = pipelineStatus || {
    total_jobs: 42,
    queued: 2,
    running: 1,
    completed: 38,
    failed: 1,
    queue_depth: 3,
    recent_jobs: [
      { id: 101, job_type: "sentinel_ingestion", aoi_id: 1, status: "completed", error_message: null, created_at: "2026-08-17T12:00:00Z" },
      { id: 102, job_type: "ndvi_calculation", aoi_id: 1, status: "completed", error_message: null, created_at: "2026-08-17T12:01:00Z" },
      { id: 103, job_type: "yield_prediction", aoi_id: 1, status: "completed", error_message: null, created_at: "2026-08-17T12:02:00Z" },
      { id: 104, job_type: "sentinel_ingestion", aoi_id: 2, status: "failed", error_message: "Cloud cover 62% exceeded 20% threshold", created_at: "2026-08-17T12:05:00Z" }
    ]
  };

  const models = modelRegistry || [
    { id: 1, version: "v1.2.0-rf-cotton", crop_type: "cotton", training_date: "2026-07-15", validation_mape: 11.4, validation_r2: 0.89, is_active: activeVersion === "v1.2.0-rf-cotton" },
    { id: 2, version: "v1.1.0-rf-cotton", crop_type: "cotton", training_date: "2026-06-20", validation_mape: 14.8, validation_r2: 0.83, is_active: activeVersion === "v1.1.0-rf-cotton" },
    { id: 3, version: "v1.0.0-rf-rice", crop_type: "rice", training_date: "2026-07-01", validation_mape: 12.1, validation_r2: 0.87, is_active: true }
  ];

  const handleRollback = async (version) => {
    setRollbackStatus(`Rolling back to ${version}...`);
    await onRollbackModel(version);
    setActiveVersion(version);
    setRollbackStatus(`Successfully rolled back active model to ${version} (No deployment restart required).`);
    setTimeout(() => setRollbackStatus(null), 4000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header Banner */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">{t.admin.pipelineHealth}</h2>
            <p className="text-xs text-slate-400">
              Celery / Redis Task Queue Operations, Pipeline Health & ML Model Version Registry
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline Status KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase font-semibold">Celery Queue Depth</span>
            <div className="text-2xl font-bold text-purple-400 mt-1">{status.queue_depth} Jobs</div>
          </div>
          <Activity className="w-6 h-6 text-purple-400 animate-pulse" />
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase font-semibold">Completed Tasks</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{status.completed}</div>
          </div>
          <CheckCircle className="w-6 h-6 text-emerald-400" />
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase font-semibold">Failed Ingestions</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">{status.failed}</div>
          </div>
          <XCircle className="w-6 h-6 text-rose-400" />
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase font-semibold">Data Freshness</span>
            <div className="text-lg font-bold text-cyan-300 mt-1">Pass 2 Days Ago</div>
          </div>
          <Database className="w-6 h-6 text-cyan-400" />
        </div>
      </div>

      {/* Rollback Notification Toast */}
      {rollbackStatus && (
        <div className="bg-purple-950/80 border border-purple-500 p-3 rounded-xl text-xs font-semibold text-purple-200 flex items-center gap-2 animate-bounce">
          <RotateCcw className="w-4 h-4 text-purple-400" />
          <span>{rollbackStatus}</span>
        </div>
      )}

      {/* ML Model Version Registry Table with 1-Click Rollback */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>{t.admin.modelRegistry} (1-Click Rollback Enabled)</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold bg-slate-900/60">
                <th className="p-3">Model Version</th>
                <th className="p-3">Crop Type</th>
                <th className="p-3">Training Date</th>
                <th className="p-3">Validation MAPE</th>
                <th className="p-3">R² Score</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {models.map((m) => {
                const isActive = m.version === activeVersion || m.is_active;
                return (
                  <tr key={m.id} className="hover:bg-slate-900/60">
                    <td className="p-3 font-bold text-purple-300">{m.version}</td>
                    <td className="p-3 uppercase text-slate-300">{m.crop_type}</td>
                    <td className="p-3 text-slate-400">{m.training_date?.split('T')[0] || m.training_date}</td>
                    <td className="p-3 font-bold text-emerald-400">{m.validation_mape}%</td>
                    <td className="p-3 text-slate-300">{m.validation_r2}</td>
                    <td className="p-3">
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Active Production
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {!isActive && m.crop_type === 'cotton' && (
                        <button
                          onClick={() => handleRollback(m.version)}
                          className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>1-Click Rollback</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
