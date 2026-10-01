import React from 'react';
import { Clock } from 'lucide-react';
import { PlayerColor } from '../types';

interface TimerDisplayProps {
  color: PlayerColor;
  playerName: string;
  timeRemainingMs: number;
  totalTimeMinutes: number;
  isActive: boolean;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  color,
  playerName,
  timeRemainingMs,
  totalTimeMinutes,
  isActive
}) => {
  const isUntimed = totalTimeMinutes <= 0;
  const isWhite = color === 'w';

  // Format mm:ss or ss.d when under 10 seconds
  const totalSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const underThirty = !isUntimed && totalSeconds <= 30;
  const underTen = !isUntimed && totalSeconds <= 10;

  const displayTime = isUntimed
    ? '∞:∞'
    : underTen
    ? `${seconds}.${Math.floor((timeRemainingMs % 1000) / 100)}s`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const totalPossibleMs = totalTimeMinutes * 60 * 1000;
  const pct = isUntimed ? 100 : Math.min(100, Math.max(0, (timeRemainingMs / totalPossibleMs) * 100));

  return (
    <div
      className={`relative px-4 py-2 rounded-lg border transition-all duration-300 backdrop-blur-md flex items-center gap-3 ${
        isActive
          ? isWhite
            ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
            : 'bg-fuchsia-950/40 border-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.4)]'
          : 'bg-slate-900/60 border-slate-800 text-slate-400'
      }`}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <Clock size={12} className={isActive ? (isWhite ? 'text-cyan-400 animate-spin' : 'text-fuchsia-400 animate-spin') : 'text-slate-500'} />
          <span className="text-[10px] font-cyber uppercase tracking-wider text-slate-400">
            {isWhite ? 'WHITE' : 'BLACK'}
          </span>
        </div>
        <div className="text-xs font-mono font-medium truncate max-w-[110px] text-slate-200">
          {playerName}
        </div>
      </div>

      <div className="flex flex-col items-end">
        <div
          className={`font-mono text-xl tracking-wider font-bold ${
            underThirty ? 'text-red-400 animate-pulse' : isActive ? 'text-white' : 'text-slate-300'
          }`}
        >
          {displayTime}
        </div>

        {!isUntimed && (
          <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full transition-all duration-300 ${
                underThirty ? 'bg-red-500' : isWhite ? 'bg-cyan-400' : 'bg-fuchsia-400'
              }`}
              style={{ width: `${pct}%` }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};
