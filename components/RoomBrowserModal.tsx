import React, { useState, useEffect } from 'react';
import { Users, Zap, Plus, RefreshCw, X, Clock, Play } from 'lucide-react';
import { PublicRoomSummary } from '../types';
import { CyberButton } from './CyberButton';
import { CyberInput } from './CyberInput';

interface RoomBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (roomCode: string) => void;
  onQuickMatch: () => void;
  onCreateRoom: (timeMinutes: number, preferredColor: 'w' | 'b' | 'random') => void;
}

export const RoomBrowserModal: React.FC<RoomBrowserModalProps> = ({
  isOpen,
  onClose,
  onJoinRoom,
  onQuickMatch,
  onCreateRoom
}) => {
  const [rooms, setRooms] = useState<PublicRoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [timeControl, setTimeControl] = useState<number>(10);
  const [colorPref, setColorPref] = useState<'w' | 'b' | 'random'>('random');

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (e) {
      console.error('Failed to load rooms:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
      const interval = setInterval(fetchRooms, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#080d1a] border border-cyan-500/80 rounded-2xl p-6 shadow-[0_0_80px_rgba(6,182,212,0.25)] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Users size={20} className="text-cyan-400" />
            <div>
              <h3 className="font-cyber text-lg font-bold text-white tracking-wider">
                NETWORK MATCH HUB
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Browse open lobbies or deploy custom tactical sector
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Tabs / Split */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Quick Match Bar */}
          <div className="bg-gradient-to-r from-cyan-950/60 via-slate-900 to-fuchsia-950/60 border border-cyan-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-cyan-300 font-cyber text-sm font-bold">
                <Zap size={16} />
                <span>RAPID CYBER MATCHMAKING</span>
              </div>
              <p className="text-xs font-mono text-slate-300 mt-1">
                Instant pairing against another online operator with 5-minute blitz clock.
              </p>
            </div>
            <CyberButton
              variant="primary"
              onClick={() => {
                onQuickMatch();
                onClose();
              }}
              className="w-full sm:w-auto"
            >
              FIND OPPONENT
            </CyberButton>
          </div>

          {/* Join with Direct Room Code */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-cyber tracking-wider text-cyan-400 uppercase mb-2">
              DIRECT ROOM ACCESS
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ENTER CODE (e.g. CYBER-8421)"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                className="flex-1 bg-black/60 border border-slate-700 rounded px-3 py-2 text-sm font-mono text-cyan-300 uppercase tracking-widest focus:border-cyan-400 focus:outline-none"
              />
              <CyberButton
                variant="secondary"
                disabled={!manualCode.trim()}
                onClick={() => {
                  if (manualCode.trim()) {
                    onJoinRoom(manualCode.trim());
                    onClose();
                  }
                }}
              >
                CONNECT
              </CyberButton>
            </div>
          </div>

          {/* Create Room Config */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-cyber tracking-wider text-fuchsia-400 uppercase mb-3">
              DEPLOY HOST MATCH
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[10px] font-cyber text-slate-400 uppercase block mb-1.5">
                  TIME CYCLE PROTOCOL
                </label>
                <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                  {[
                    { label: '3m', val: 3 },
                    { label: '5m', val: 5 },
                    { label: '10m', val: 10 },
                    { label: '∞', val: 0 }
                  ].map((t) => (
                    <button
                      key={t.val}
                      type="button"
                      onClick={() => setTimeControl(t.val)}
                      className={`py-1.5 px-2 rounded border transition-all text-center ${
                        timeControl === t.val
                          ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-cyber text-slate-400 uppercase block mb-1.5">
                  PREFERRED SECTOR COLOR
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs font-cyber">
                  {[
                    { label: 'WHITE', val: 'w' },
                    { label: 'RANDOM', val: 'random' },
                    { label: 'BLACK', val: 'b' }
                  ].map((c) => (
                    <button
                      key={c.val}
                      type="button"
                      onClick={() => setColorPref(c.val as any)}
                      className={`py-1.5 px-2 rounded border transition-all text-center ${
                        colorPref === c.val
                          ? 'bg-fuchsia-950 border-fuchsia-400 text-fuchsia-300 shadow-[0_0_10px_rgba(217,70,239,0.4)]'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <CyberButton
              variant="primary"
              onClick={() => {
                onCreateRoom(timeControl, colorPref);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              <span>INITIALIZE NEW MATCH</span>
            </CyberButton>
          </div>

          {/* Public Rooms Directory */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-cyber tracking-wider text-slate-300 uppercase">
                ACTIVE WAITING LOBBIES ({rooms.length})
              </h4>
              <button
                onClick={fetchRooms}
                disabled={loading}
                className="text-xs font-mono text-cyan-400 flex items-center gap-1 hover:text-cyan-300 disabled:opacity-50"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                <span>REFRESH</span>
              </button>
            </div>

            {rooms.length === 0 ? (
              <div className="text-center py-6 bg-slate-950/40 rounded-xl border border-slate-800/80 text-xs font-mono text-slate-500">
                No open lobbies found. Create one above or use Quick Match!
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map((r) => (
                  <div
                    key={r.roomCode}
                    className="p-3 bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 rounded-xl flex items-center justify-between gap-4 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-cyan-300 tracking-wider">
                          {r.roomCode}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 flex items-center gap-1">
                          <Clock size={10} />
                          {r.initialMinutes > 0 ? `${r.initialMinutes}m` : 'Untimed'}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-400 mt-0.5">
                        Host: <span className="text-slate-200">{r.hostName}</span> (1/2 Players)
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onJoinRoom(r.roomCode);
                        onClose();
                      }}
                      className="px-4 py-1.5 rounded bg-cyan-950 border border-cyan-500 text-cyan-300 font-cyber text-xs font-bold hover:bg-cyan-500 hover:text-black transition-all flex items-center gap-1.5"
                    >
                      <Play size={12} />
                      <span>ENGAGE</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
