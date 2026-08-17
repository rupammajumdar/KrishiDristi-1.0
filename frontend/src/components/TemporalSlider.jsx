import React, { useState, useEffect } from 'react';
import { Calendar, Play, Pause, SkipBack, SkipForward, Cloud, Sparkles } from 'lucide-react';

export default function TemporalSlider({ 
  timeline, 
  selectedDateIndex, 
  onSelectDateIndex, 
  currentLang 
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  const dates = timeline?.dates || [
    { acquisition_date: new Date(Date.now() - 20 * 86400000).toISOString(), cloud_cover_pct: 2.1 },
    { acquisition_date: new Date(Date.now() - 15 * 86400000).toISOString(), cloud_cover_pct: 4.5 },
    { acquisition_date: new Date(Date.now() - 10 * 86400000).toISOString(), cloud_cover_pct: 1.8 },
    { acquisition_date: new Date(Date.now() - 5 * 86400000).toISOString(), cloud_cover_pct: 3.2 }
  ];

  // Auto-play time lapse scrubber
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        onSelectDateIndex((prev) => (prev + 1) % dates.length);
      }, 1800);
    }
    return () => clearInterval(interval);
  }, [isPlaying, dates.length, onSelectDateIndex]);

  const currentDate = dates[selectedDateIndex] || dates[0];
  const dateStr = new Date(currentDate.acquisition_date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="glass-panel rounded-2xl p-4 border border-slate-800 shadow-2xl flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
          <Calendar className="w-4 h-4" />
          <span>Time-Machine Temporal Slider (Sentinel-2)</span>
        </div>

        {/* Selected Pass Date Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <Cloud className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cloud Cover: {currentDate.cloud_cover_pct}%</span>
          </div>
          <div className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-xl text-xs font-mono font-bold shadow-md">
            {dateStr}
          </div>
        </div>
      </div>

      {/* Slider Controls & Track */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Time Lapse */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-lg"
          title={isPlaying ? "Pause Time-Lapse" : "Play Time-Lapse"}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
        </button>

        {/* Step Prev */}
        <button
          onClick={() => onSelectDateIndex(Math.max(0, selectedDateIndex - 1))}
          disabled={selectedDateIndex === 0}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Scrubber Range Bar with Pass Markers */}
        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min="0"
            max={dates.length - 1}
            step="1"
            value={selectedDateIndex}
            onChange={(e) => onSelectDateIndex(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-900 rounded-lg appearance-none border border-slate-800"
          />
        </div>

        {/* Step Next */}
        <button
          onClick={() => onSelectDateIndex(Math.min(dates.length - 1, selectedDateIndex + 1))}
          disabled={selectedDateIndex === dates.length - 1}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
