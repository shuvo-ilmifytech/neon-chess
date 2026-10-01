import React from 'react';
import { Trophy, RefreshCw, LogOut, Eye, Award, Frown, Equal } from 'lucide-react';
import { PlayerColor, RoomStatus } from '../types';
import { CyberButton } from './CyberButton';

interface GameOverModalProps {
  status: RoomStatus;
  winner: PlayerColor | 'draw' | null;
  myColor?: PlayerColor | 'spectator';
  rematchVotes: { w: boolean; b: boolean };
  onVoteRematch: () => void;
  onExitLobby: () => void;
  onDismiss: () => void;
  isDismissed: boolean;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  status,
  winner,
  myColor,
  rematchVotes,
  onVoteRematch,
  onExitLobby,
  onDismiss,
  isDismissed
}) => {
  if (isDismissed) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={onDismiss}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900/90 border border-cyan-500 rounded-lg text-cyan-300 font-cyber text-xs shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:bg-cyan-950 transition-all"
        >
          <Award size={16} />
          <span>VIEW MATCH SUMMARY</span>
        </button>
      </div>
    );
  }

  const isDraw = winner === 'draw' || status === 'draw' || status === 'stalemate';
  const isMeWinner = myColor && myColor !== 'spectator' && winner === myColor;
  const isMeLoser = myColor && myColor !== 'spectator' && winner && winner !== myColor && !isDraw;

  const myVote = myColor === 'w' ? rematchVotes.w : myColor === 'b' ? rematchVotes.b : false;
  const opponentVote = myColor === 'w' ? rematchVotes.b : myColor === 'b' ? rematchVotes.w : false;

  let title = 'HOSTILITIES CONCLUDED';
  let subtitle = 'Match Complete';

  if (status === 'checkmate') {
    title = 'CHECKMATE';
    subtitle = winner === 'w' ? 'WHITE FORCES PREVAILED' : 'BLACK FORCES PREVAILED';
  } else if (status === 'resigned') {
    title = 'SURRENDER';
    subtitle = winner === 'w' ? 'BLACK RESIGNED - WHITE WINS' : 'WHITE RESIGNED - BLACK WINS';
  } else if (status === 'timeout') {
    title = 'SYSTEM TIMEOUT';
    subtitle = winner === 'w' ? 'BLACK OUT OF CLOCK CYCLES' : 'WHITE OUT OF CLOCK CYCLES';
  } else if (status === 'stalemate') {
    title = 'STALEMATE';
    subtitle = 'NO LEGAL TACTICAL MOVES REMAIN';
  } else if (isDraw) {
    title = 'CEASEFIRE / DRAW';
    subtitle = 'TACTICAL EQUILIBRIUM ACHIEVED';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-[#080d1a] border border-cyan-500/80 rounded-2xl p-6 sm:p-8 shadow-[0_0_80px_rgba(6,182,212,0.3)] overflow-hidden text-center">
        {/* Holographic background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-fuchsia-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Icon status */}
        <div className="flex justify-center mb-4">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-xl ${
              isMeWinner
                ? 'bg-amber-950/40 border-amber-400 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.5)]'
                : isMeLoser
                ? 'bg-red-950/40 border-red-500 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.5)]'
                : 'bg-cyan-950/40 border-cyan-400 text-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.5)]'
            }`}
          >
            {isMeWinner && <Trophy size={32} className="animate-bounce" />}
            {isMeLoser && <Frown size={32} />}
            {isDraw && <Equal size={32} />}
            {!isMeWinner && !isMeLoser && !isDraw && <Award size={32} />}
          </div>
        </div>

        {/* Result banner */}
        <h2 className="text-3xl font-cyber font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-fuchsia-400 mb-1">
          {title}
        </h2>
        <p className="text-xs font-mono tracking-widest text-slate-400 uppercase mb-6">
          {subtitle}
        </p>

        {/* Player result highlight */}
        {myColor && myColor !== 'spectator' && (
          <div
            className={`p-3 rounded-xl border mb-6 text-sm font-cyber font-bold tracking-wide ${
              isMeWinner
                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300'
                : isMeLoser
                ? 'bg-red-950/40 border-red-500/60 text-red-300'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            {isMeWinner && 'VICTORY ACHIEVED! TACTICAL SUPERIORITY RECORDED.'}
            {isMeLoser && 'DEFEAT: CORE SYSTEM SHUTDOWN. RECALIBRATE.'}
            {isDraw && 'DRAW: PROTOCOLS BALANCED.'}
          </div>
        )}

        {/* Rematch status */}
        {myColor && myColor !== 'spectator' && (
          <div className="text-xs font-mono text-slate-400 mb-6 flex items-center justify-center gap-4">
            <span className={myVote ? 'text-emerald-400' : 'text-slate-500'}>
              {myVote ? '✓ You Voted Rematch' : '○ Rematch Pending'}
            </span>
            <span className="text-slate-600">|</span>
            <span className={opponentVote ? 'text-emerald-400' : 'text-slate-500'}>
              {opponentVote ? '✓ Opponent Voted Rematch' : '○ Opponent Pending'}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {myColor && myColor !== 'spectator' && (
            <CyberButton
              variant={myVote ? 'secondary' : 'primary'}
              onClick={onVoteRematch}
              disabled={myVote}
              className="w-full flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} className={myVote ? 'animate-spin' : ''} />
              <span>{myVote ? 'REMATCH REQUEST TRANSMITTED' : 'REQUEST REMATCH'}</span>
            </CyberButton>
          )}

          <div className="flex gap-3">
            <button
              onClick={onDismiss}
              className="flex-1 py-2.5 px-4 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 font-cyber text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Eye size={14} />
              <span>INSPECT BOARD</span>
            </button>

            <button
              onClick={onExitLobby}
              className="flex-1 py-2.5 px-4 rounded-lg bg-red-950/40 border border-red-800/80 hover:bg-red-900/60 text-red-300 font-cyber text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut size={14} />
              <span>EXIT TO LOBBY</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
