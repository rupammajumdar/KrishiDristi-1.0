import React from 'react';
import { Bell, X, AlertTriangle, Droplets, CheckCircle2, ChevronRight } from 'lucide-react';

export default function NotificationCenter({ 
  alerts, 
  isOpen, 
  onClose, 
  onSelectAlert 
}) {
  if (!isOpen) return null;

  const mockAlerts = alerts || [
    {
      id: 1,
      aoi_id: 1,
      alert_type: "drought_risk",
      severity: "high",
      message: "Drought Warning: Cotton yield predicted 21.8% below 5-year average.",
      recommendation: "Irrigate field within 48 hours to prevent severe yield damage.",
      created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
      status: "open"
    },
    {
      id: 2,
      aoi_id: 2,
      alert_type: "water_depletion",
      severity: "medium",
      message: "Ghanewadi Reservoir surface area shrunk by 18.5% compared to 5-year baseline.",
      recommendation: "Monitor taluk water rationing policies.",
      created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
      status: "open"
    }
  ];

  return (
    <div className="fixed inset-y-0 right-0 w-80 sm:w-96 glass-panel border-l border-slate-800 z-[1000] p-4 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <Bell className="w-4 h-4" />
            <span>Early Warning Alert Feed (90-Day Log)</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alert List */}
        <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-120px)] pr-1">
          {mockAlerts.map((alt) => (
            <div 
              key={alt.id}
              onClick={() => onSelectAlert(alt)}
              className="glass-card rounded-xl p-3 border border-slate-800 hover:border-emerald-500/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {alt.alert_type.replace('_', ' ')}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {new Date(alt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-100 mb-1">{alt.message}</p>
              <p className="text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                <b className="text-emerald-400">Rec:</b> {alt.recommendation}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-800 text-center">
        <span className="text-[11px] text-slate-500">SMS Notifications sent to registered phone</span>
      </div>
    </div>
  );
}
