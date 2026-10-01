import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Terminal } from 'lucide-react';
import { ChatMessage } from '../types';

interface CyberChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

const QUICK_PINGS = [
  'Good Game',
  'Checkmate Threat!',
  'Well Played',
  'Tactical Blunder?',
  'Shields Up!',
  'Rematch?'
];

export const CyberChat: React.FC<CyberChatProps> = ({ messages, onSendMessage, disabled }) => {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full bg-[#080d1a]/80 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-md">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2 text-cyan-400">
          <Terminal size={14} />
          <span className="text-xs font-cyber tracking-widest uppercase">HOLO-COMMS</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500">ENCRYPTED</span>
      </div>

      {/* Messages stream */}
      <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-2 text-xs font-mono">
        {messages.length === 0 && (
          <div className="text-center py-6 text-slate-600 text-xs">
            Awaiting transmission... Send tactical communications below.
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-2 rounded transition-all duration-200 ${
              m.isSystem
                ? 'bg-amber-950/20 border-l-2 border-amber-500 text-amber-300/90'
                : 'bg-slate-900/50 border border-slate-800/60'
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span
                className="font-cyber text-[10px] font-bold tracking-wider"
                style={{ color: m.color || (m.isSystem ? '#f59e0b' : '#38bdf8') }}
              >
                {m.sender}
              </span>
              <span className="text-[9px] text-slate-500">
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <p className="text-slate-200 break-words leading-relaxed">{m.text}</p>
          </div>
        ))}
      </div>

      {/* Quick Pings */}
      <div className="p-2 border-t border-slate-800/60 bg-slate-950/40 flex flex-wrap gap-1">
        {QUICK_PINGS.map((ping) => (
          <button
            key={ping}
            type="button"
            disabled={disabled}
            onClick={() => onSendMessage(ping)}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/60 text-slate-300 hover:bg-cyan-950 hover:text-cyan-300 hover:border-cyan-600/50 border border-transparent transition-all disabled:opacity-40"
          >
            {ping}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-slate-800/80 bg-slate-950/90 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={disabled ? 'Comms disabled' : 'Transmit transmission...'}
          disabled={disabled}
          maxLength={120}
          className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !inputText.trim()}
          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-cyber text-xs font-bold rounded transition-colors disabled:opacity-40 flex items-center justify-center"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
};
