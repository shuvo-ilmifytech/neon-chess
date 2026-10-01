import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Square, Move } from 'chess.js';
import {
  Copy,
  Share2,
  Volume2,
  VolumeX,
  Shield,
  Zap,
  History,
  Bot,
  Users,
  Swords,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Flag,
  Handshake,
  Radio,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { ChessBoard } from './components/ChessBoard';
import { CyberButton } from './components/CyberButton';
import { CyberInput } from './components/CyberInput';
import { TimerDisplay } from './components/TimerDisplay';
import { CyberChat } from './components/CyberChat';
import { GameOverModal } from './components/GameOverModal';
import { RoomBrowserModal } from './components/RoomBrowserModal';
import { CyberToastContainer, ToastMessage } from './components/CyberToast';
import {
  Player,
  PlayerColor,
  PlayerRole,
  RoomStatus,
  RoomState,
  WSMessage,
  GameMode,
  AIDifficulty,
  ChatMessage
} from './types';
import { sfx } from './utils/sound';
import { getBestMove } from './utils/chessAI';

export const App: React.FC = () => {
  // Mode selection: Online, Cyber AI, or Local Pass-and-Play
  const [gameMode, setGameMode] = useState<GameMode>('online');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('tactical');
  const [aiThinking, setAiThinking] = useState(false);

  // Player identity & connection
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('neon_player_name') || 'Operator-' + Math.floor(100 + Math.random() * 900);
  });
  const [playerId] = useState(() => {
    let id = localStorage.getItem('neon_player_id');
    if (!id) {
      id = 'user-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('neon_player_id', id);
    }
    return id;
  });

  // Game & Room States
  const [game, setGame] = useState<Chess>(new Chess());
  const [status, setStatus] = useState<RoomStatus>('init');
  const [myRole, setMyRole] = useState<PlayerRole>('w');
  const [boardOrientation, setBoardOrientation] = useState<PlayerColor>('w');
  const [opponent, setOpponent] = useState<Player | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square; san: string } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [winner, setWinner] = useState<PlayerColor | 'draw' | null>(null);
  const [drawOfferFrom, setDrawOfferFrom] = useState<PlayerColor | null>(null);
  const [rematchVotes, setRematchVotes] = useState<{ w: boolean; b: boolean }>({ w: false, b: false });

  // Timers
  const [timeControl, setTimeControl] = useState({
    initialMinutes: 10,
    incrementSeconds: 0,
    whiteRemainingMs: 10 * 60 * 1000,
    blackRemainingMs: 10 * 60 * 1000,
    lastTurnStartTime: null as number | null
  });

  // Chat & Toasts
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isGameOverDismissed, setIsGameOverDismissed] = useState(false);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Networking refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper for stylish non-blocking toasts
  const addToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { ...msg, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sound toggle
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sfx.toggle(next);
  };

  // WebSocket Connection Initializer
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('[NEON CORE] WebSocket connection established.');
      };

      socket.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          handleServerMessage(msg);
        } catch (e) {
          console.error('WebSocket message parsing error:', e);
        }
      };

      socket.onclose = () => {
        console.log('[NEON CORE] WebSocket closed. Auto-reconnecting in 2s...');
        wsRef.current = null;
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 2000);
      };

      socket.onerror = (err) => {
        console.warn('[NEON CORE] WebSocket warning:', err);
      };

      wsRef.current = socket;
    } catch (e) {
      console.error('Failed to construct WebSocket:', e);
    }
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket]);

  // Keep heartbeat alive
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 25000);
    return () => clearInterval(pingInterval);
  }, []);

  // Check URL params for direct room link (e.g. ?room=CYBER-1234)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      const clean = roomParam.trim().toUpperCase();
      setInputRoomCode(clean);
      addToast({
        type: 'info',
        title: 'TACTICAL LINK DETECTED',
        message: `Detected Room link for [${clean}]. Click CONNECT to engage.`,
        actionText: 'CONNECT NOW',
        onAction: () => joinRoom(clean)
      });
    }
  }, []);

  // Save alias to localStorage
  useEffect(() => {
    localStorage.setItem('neon_player_name', playerName);
  }, [playerName]);

  // Send message helper
  const sendWS = (msg: WSMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      addToast({
        type: 'warning',
        title: 'TRANSMISSION DELAYED',
        message: 'Re-establishing neural uplink with server core. Retrying in 1s...'
      });
      connectWebSocket();
    }
  };

  // Handle incoming server messages
  const handleServerMessage = (msg: WSMessage) => {
    const { type, payload } = msg;

    switch (type) {
      case 'ROOM_CREATED': {
        const { roomCode: rCode, role, state } = payload;
        setRoomCode(rCode);
        setMyRole(role);
        setBoardOrientation(role === 'b' ? 'b' : 'w');
        applyRoomState(state);
        setStatus('lobby');
        sfx.playGameStart();
        addToast({
          type: 'success',
          title: 'TACTICAL MATRIX CREATED',
          message: `Room [${rCode}] initialized. Share this code with your challenger.`
        });
        break;
      }

      case 'ROOM_JOINED': {
        const { roomCode: rCode, role, state } = payload;
        setRoomCode(rCode);
        setMyRole(role);
        setBoardOrientation(role === 'b' ? 'b' : 'w');
        setIsMatchmaking(false);
        applyRoomState(state);
        sfx.playGameStart();
        addToast({
          type: 'success',
          title: 'UPLINK SYNCHRONIZED',
          message: `Connected to Sector [${rCode}] as ${role === 'w' ? 'WHITE' : role === 'b' ? 'BLACK' : 'SPECTATOR'}.`
        });
        break;
      }

      case 'ROOM_UPDATE': {
        applyRoomState(payload.state);
        break;
      }

      case 'MOVE_MADE': {
        const { move, state } = payload;
        applyRoomState(state);
        
        // Audio triggers
        if (state.inCheck) {
          sfx.playCheck();
        } else if (move.captured) {
          sfx.playCapture();
        } else {
          sfx.playMove();
        }
        break;
      }

      case 'CHAT_MESSAGE': {
        setChatMessages((prev) => [...prev, payload]);
        if (!payload.isSystem) {
          sfx.playPing();
        }
        break;
      }

      case 'MATCHMAKING_STATUS': {
        setIsMatchmaking(payload.inQueue);
        break;
      }

      case 'ERROR': {
        setIsMatchmaking(false);
        sfx.playAlert();
        const attempted = payload.attemptedCode;
        addToast({
          type: 'error',
          title: 'NEURAL LINK FAILED',
          message: payload.message || 'Signal disruption detected.',
          actionText: attempted ? `CREATE [${attempted}]` : 'LAUNCH QUICK MATCH',
          onAction: () => {
            if (attempted) {
              createRoom(10, 'w', attempted);
            } else {
              startQuickMatch();
            }
          }
        });
        break;
      }
    }
  };

  const applyRoomState = (state: RoomState) => {
    if (!state) return;
    try {
      const chessInstance = new Chess(state.fen);
      setGame(chessInstance);
      setStatus(state.status);
      setLastMove(state.lastMove);
      setHistory(state.history);
      setHistoryIndex(null);
      setWinner(state.winner);
      setDrawOfferFrom(state.drawOfferFrom);
      setRematchVotes(state.rematchVotes);
      setTimeControl(state.timeControl);
      setChatMessages(state.chatMessages);

      // Determine opponent
      if (myRole === 'w') {
        setOpponent(state.black);
      } else if (myRole === 'b') {
        setOpponent(state.white);
      } else {
        setOpponent(state.white);
      }

      // Check for game completion
      if (['checkmate', 'draw', 'stalemate', 'resigned', 'timeout'].includes(state.status)) {
        setIsGameOverDismissed(false);
        if (state.winner === 'draw') {
          sfx.playAlert();
        } else if (myRole !== 'spectator' && state.winner === myRole) {
          sfx.playWin();
        } else {
          sfx.playLoss();
        }
      }
    } catch (e) {
      console.error('Failed to parse board state from server:', e);
    }
  };

  // Online Action Triggers
  const createRoom = (timeMinutes: number = 10, preferredColor: 'w' | 'b' | 'random' = 'w', customRoomCode?: string) => {
    setGameMode('online');
    sendWS({
      type: 'CREATE_ROOM',
      payload: {
        name: playerName,
        playerId,
        timeMinutes,
        preferredColor,
        customRoomCode
      }
    });
  };

  const joinRoom = (code: string) => {
    const sanitized = (code || inputRoomCode).trim().toUpperCase();
    if (!sanitized) {
      addToast({
        type: 'warning',
        title: 'INVALID ACCESS CODE',
        message: 'Please provide a valid Sector Access Code to connect.'
      });
      return;
    }
    setGameMode('online');
    sendWS({
      type: 'JOIN_ROOM',
      payload: {
        roomCode: sanitized,
        name: playerName,
        playerId
      }
    });
  };

  const startQuickMatch = () => {
    setGameMode('online');
    setIsMatchmaking(true);
    sendWS({
      type: 'QUICK_MATCH',
      payload: {
        name: playerName,
        playerId
      }
    });
    addToast({
      type: 'info',
      title: 'SCANNING FOR OPPONENT',
      message: 'Searching the neural matrix for an active challenger...'
    });
  };

  const cancelQuickMatch = () => {
    setIsMatchmaking(false);
    sendWS({ type: 'CANCEL_QUICK_MATCH' });
  };

  const resignGame = () => {
    if (gameMode === 'online') {
      sendWS({ type: 'RESIGN' });
    } else {
      const activeColor = game.turn();
      const winColor: PlayerColor = activeColor === 'w' ? 'b' : 'w';
      setStatus('resigned');
      setWinner(winColor);
      setIsGameOverDismissed(false);
      sfx.playLoss();
    }
  };

  const offerDraw = () => {
    if (gameMode === 'online') {
      sendWS({ type: 'OFFER_DRAW' });
      addToast({
        type: 'info',
        title: 'CEASEFIRE TRANSMITTED',
        message: 'Draw protocols transmitted to opponent for consideration.'
      });
    } else {
      setStatus('draw');
      setWinner('draw');
      setIsGameOverDismissed(false);
      sfx.playAlert();
    }
  };

  const respondDraw = (accept: boolean) => {
    sendWS({
      type: 'RESPOND_DRAW',
      payload: { accept }
    });
  };

  const voteRematch = () => {
    if (gameMode === 'online') {
      sendWS({ type: 'VOTE_REMATCH' });
      addToast({
        type: 'info',
        title: 'REMATCH VOTE CAST',
        message: 'Awaiting opponent confirmation to re-engage.'
      });
    } else {
      resetLocalGame();
    }
  };

  const sendChatMessage = (text: string) => {
    if (gameMode === 'online') {
      sendWS({
        type: 'CHAT',
        payload: { text }
      });
    } else {
      // Local chat echo
      setChatMessages((prev) => [
        ...prev,
        {
          id: 'local-' + Date.now(),
          sender: playerName,
          text,
          timestamp: Date.now(),
          color: '#22d3ee'
        }
      ]);
    }
  };

  // Local / AI Game Handlers
  const startAIGame = (difficulty: AIDifficulty = 'tactical', playerColor: PlayerColor = 'w') => {
    setGameMode('ai');
    setAiDifficulty(difficulty);
    setMyRole(playerColor);
    setBoardOrientation(playerColor);
    setOpponent({
      id: 'ai-core',
      name: difficulty === 'novice' ? 'Cyborg Novice' : difficulty === 'tactical' ? 'Tactical AI' : 'Deep Neural Master',
      color: playerColor === 'w' ? 'b' : 'w',
      connected: true
    });
    const newG = new Chess();
    setGame(newG);
    setStatus('playing');
    setLastMove(null);
    setHistory([]);
    setHistoryIndex(null);
    setWinner(null);
    setTimeControl({
      initialMinutes: 0,
      incrementSeconds: 0,
      whiteRemainingMs: 0,
      blackRemainingMs: 0,
      lastTurnStartTime: null
    });
    sfx.playGameStart();

    // If AI is white, trigger first move
    if (playerColor === 'b') {
      triggerAIMove(newG, difficulty);
    }
  };

  const startPassAndPlay = () => {
    setGameMode('pass-and-play');
    setMyRole('w');
    setBoardOrientation('w');
    setOpponent({
      id: 'p2-local',
      name: 'Player 2 (Black)',
      color: 'b',
      connected: true
    });
    const newG = new Chess();
    setGame(newG);
    setStatus('playing');
    setLastMove(null);
    setHistory([]);
    setHistoryIndex(null);
    setWinner(null);
    sfx.playGameStart();
  };

  const resetLocalGame = () => {
    const newG = new Chess();
    setGame(newG);
    setStatus('playing');
    setLastMove(null);
    setHistory([]);
    setHistoryIndex(null);
    setWinner(null);
    setIsGameOverDismissed(false);
    sfx.playGameStart();
    if (gameMode === 'ai' && myRole === 'b') {
      triggerAIMove(newG, aiDifficulty);
    }
  };

  const triggerAIMove = (currentChess: Chess, diff: AIDifficulty) => {
    setAiThinking(true);
    setTimeout(() => {
      const best = getBestMove(currentChess, diff);
      if (best) {
        try {
          const move = currentChess.move(best);
          if (move) {
            setGame(new Chess(currentChess.fen()));
            setLastMove({ from: move.from, to: move.to, san: move.san });
            setHistory((prev) => [...prev, move.san]);

            if (currentChess.isGameOver()) {
              if (currentChess.isCheckmate()) {
                setStatus('checkmate');
                setWinner(move.color);
                sfx.playLoss();
              } else {
                setStatus('draw');
                setWinner('draw');
                sfx.playAlert();
              }
              setIsGameOverDismissed(false);
            } else if (currentChess.inCheck()) {
              sfx.playCheck();
            } else if (move.captured) {
              sfx.playCapture();
            } else {
              sfx.playMove();
            }
          }
        } catch (e) {
          console.error('AI move error:', e);
        }
      }
      setAiThinking(false);
    }, 450);
  };

  // Board Move Dispatcher
  const handleBoardMove = (from: Square, to: Square, promotion: string = 'q') => {
    if (gameMode === 'online') {
      sendWS({
        type: 'MOVE',
        payload: { from, to, promotion }
      });
      return;
    }

    // Local / AI execution
    try {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({ from, to, promotion });

      if (move) {
        setGame(gameCopy);
        setLastMove({ from: move.from, to: move.to, san: move.san });
        setHistory((prev) => [...prev, move.san]);

        if (gameCopy.isGameOver()) {
          if (gameCopy.isCheckmate()) {
            setStatus('checkmate');
            setWinner(move.color);
            sfx.playWin();
          } else {
            setStatus('draw');
            setWinner('draw');
            sfx.playAlert();
          }
          setIsGameOverDismissed(false);
        } else if (gameCopy.inCheck()) {
          sfx.playCheck();
        } else if (move.captured) {
          sfx.playCapture();
        } else {
          sfx.playMove();
        }

        // Trigger AI response if playing against bot
        if (gameMode === 'ai' && !gameCopy.isGameOver()) {
          triggerAIMove(gameCopy, aiDifficulty);
        }

        // Auto flip in pass-and-play
        if (gameMode === 'pass-and-play') {
          setBoardOrientation((prev) => (prev === 'w' ? 'b' : 'w'));
        }
      }
    } catch (e) {
      console.error('Invalid move on board:', e);
    }
  };

  // Move history review
  const handleReviewStep = (direction: 'prev' | 'next' | 'current') => {
    if (history.length === 0) return;

    let targetIdx = historyIndex === null ? history.length - 1 : historyIndex;
    if (direction === 'prev') {
      targetIdx = Math.max(0, targetIdx - 1);
    } else if (direction === 'next') {
      targetIdx = Math.min(history.length - 1, targetIdx + 1);
    } else {
      setHistoryIndex(null);
      return;
    }

    setHistoryIndex(targetIdx);
  };

  const getDisplayedGame = (): Chess => {
    if (historyIndex === null || historyIndex >= history.length - 1) {
      return game;
    }
    const replayGame = new Chess();
    for (let i = 0; i <= historyIndex; i++) {
      try {
        replayGame.move(history[i]);
      } catch (e) {
        break;
      }
    }
    return replayGame;
  };

  const displayedGame = getDisplayedGame();
  const isReviewing = historyIndex !== null && historyIndex < history.length - 1;

  // Copy share link
  const copyRoomCode = () => {
    if (!roomCode) return;
    const shareUrl = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      addToast({
        type: 'success',
        title: 'INVITE LINK COPIED',
        message: `Shareable sector uplink: ${shareUrl}`
      });
    }).catch(() => {
      navigator.clipboard.writeText(roomCode);
      addToast({
        type: 'success',
        title: 'SECTOR CODE COPIED',
        message: `Code [${roomCode}] copied to clipboard.`
      });
    });
  };

  // Interactive turn check
  const isMyTurn = () => {
    if (status !== 'playing' || isReviewing) return false;
    if (gameMode === 'pass-and-play') return true;
    if (gameMode === 'ai') return game.turn() === myRole && !aiThinking;
    return myRole !== 'spectator' && game.turn() === myRole;
  };

  // ================= RENDER =================

  // 1. Initial Launch / Lobby Screen
  if (status === 'init') {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Cyber Grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34, 211, 238, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.2) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            transform: 'perspective(600px) rotateX(45deg) translateY(-80px) scale(2)'
          }}
        ></div>

        <CyberToastContainer toasts={toasts} onDismiss={dismissToast} />

        {/* Central HUD Card */}
        <div className="relative z-10 w-full max-w-lg bg-[#070c18]/90 border border-cyan-500/40 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_80px_rgba(6,182,212,0.2)]">
          {/* Holographic Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-mono tracking-widest uppercase mb-3 animate-pulse">
              <Radio size={12} />
              <span>TACTICAL QUANTUM INTERFACE</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-cyber font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-fuchsia-400">
              NEON GAMBIT
            </h1>
            <p className="text-xs sm:text-sm font-mono text-slate-400 mt-1 tracking-wider">
              REAL-TIME HOLOGRAPHIC CHESS MATRIX
            </p>
          </div>

          {/* Alias Configuration */}
          <div className="mb-6">
            <CyberInput
              label="OPERATOR IDENTIFIER (CODENAME)"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="ENTER CALLSIGN"
              maxLength={20}
            />
          </div>

          {/* Engagement Modes Selector */}
          <div className="space-y-4">
            {/* Online Operations */}
            <div className="p-4 bg-slate-950/70 border border-cyan-500/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-cyber text-cyan-400 tracking-wider flex items-center gap-1.5 font-bold">
                  <Swords size={16} /> MULTIPLAYER OPERATIONS
                </span>
                <span className="text-[10px] font-mono text-emerald-400">● SERVER ACTIVE</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <CyberButton
                  variant="primary"
                  onClick={() => createRoom(10, 'w')}
                  className="flex items-center justify-center gap-2 text-xs py-2.5"
                >
                  <Zap size={14} />
                  <span>HOST MATCH</span>
                </CyberButton>

                <CyberButton
                  variant="secondary"
                  onClick={startQuickMatch}
                  className="flex items-center justify-center gap-2 text-xs py-2.5"
                >
                  <Radio size={14} />
                  <span>QUICK MATCH</span>
                </CyberButton>
              </div>

              {/* Direct Code Join */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="ROOM ACCESS CODE"
                  value={inputRoomCode}
                  onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-black/60 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-cyan-300 uppercase tracking-widest focus:border-cyan-400 focus:outline-none"
                />
                <button
                  onClick={() => joinRoom(inputRoomCode)}
                  className="px-4 py-2 bg-slate-800 hover:bg-cyan-900 border border-slate-700 hover:border-cyan-500 text-cyan-300 font-cyber text-xs rounded transition-colors"
                >
                  CONNECT
                </button>
              </div>

              <button
                onClick={() => setIsBrowserOpen(true)}
                className="w-full text-center text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors pt-1 flex items-center justify-center gap-1"
              >
                <span>Browse Active Lobbies & Custom Clock Options</span>
                <ExternalLink size={12} />
              </button>
            </div>

            {/* Offline Simulation / Practice */}
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
              <span className="text-xs font-cyber text-fuchsia-400 tracking-wider flex items-center gap-1.5 font-bold">
                <Bot size={16} /> TACTICAL BOT PROTOCOL
              </span>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { diff: 'novice', label: 'Novice' },
                  { diff: 'tactical', label: 'Cyborg' },
                  { diff: 'master', label: 'Grandmaster' }
                ].map((item) => (
                  <button
                    key={item.diff}
                    onClick={() => startAIGame(item.diff as AIDifficulty, 'w')}
                    className="p-2 rounded bg-slate-900 border border-slate-700 hover:border-fuchsia-500 hover:bg-fuchsia-950/40 text-slate-300 font-cyber text-xs transition-all text-center"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pt-1 flex items-center justify-between border-t border-slate-800/80">
                <span className="text-[11px] font-mono text-slate-400">Same Device Pass & Play:</span>
                <button
                  onClick={startPassAndPlay}
                  className="text-xs font-cyber text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <Users size={14} />
                  <span>LOCAL DUEL</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Room Browser & Config Modal */}
        <RoomBrowserModal
          isOpen={isBrowserOpen}
          onClose={() => setIsBrowserOpen(false)}
          onJoinRoom={(code) => joinRoom(code)}
          onQuickMatch={startQuickMatch}
          onCreateRoom={(minutes, color) => createRoom(minutes, color)}
        />
      </div>
    );
  }

  // 2. Waiting Lobby for Host
  if (status === 'lobby') {
    return (
      <div className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center p-4 relative">
        <CyberToastContainer toasts={toasts} onDismiss={dismissToast} />

        <div className="w-full max-w-md bg-[#080d1a] border border-cyan-500/60 rounded-2xl p-6 sm:p-8 text-center shadow-[0_0_60px_rgba(6,182,212,0.25)] relative">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto mb-4"></div>

          <h2 className="text-2xl font-cyber text-cyan-400 font-bold tracking-wider mb-2">
            WAITING FOR OPPONENT...
          </h2>
          <p className="text-xs font-mono text-slate-400 mb-6">
            Sector frequency initialized. Transmit this access code to your challenger.
          </p>

          <div
            onClick={copyRoomCode}
            className="p-4 bg-cyan-950/30 border border-cyan-500/50 rounded-xl cursor-pointer hover:bg-cyan-950/50 transition-all mb-4 group"
          >
            <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">
              SECTOR ACCESS CODE (CLICK TO COPY)
            </div>
            <div className="text-3xl font-mono text-white font-bold tracking-widest flex items-center justify-center gap-2 group-hover:scale-105 transition-transform">
              <span>{roomCode}</span>
              <Copy size={18} className="text-cyan-400" />
            </div>
          </div>

          <div className="flex gap-2">
            <CyberButton variant="primary" onClick={copyRoomCode} className="flex-1 flex items-center justify-center gap-2 text-xs">
              <Share2 size={14} />
              <span>COPY INVITE LINK</span>
            </CyberButton>

            <button
              onClick={() => setStatus('init')}
              className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 font-cyber text-xs hover:text-white"
            >
              ABORT
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Active Playing / Live Match Screen
  return (
    <div className="min-h-screen bg-[#030712] text-white flex flex-col overflow-hidden">
      <CyberToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Top Holographic Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-[#070c18]/90 backdrop-blur-md px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#22d3ee]"></div>
            <span className="font-cyber font-bold text-base tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400">
              NEON GAMBIT
            </span>
          </div>

          {gameMode === 'online' && roomCode && (
            <div
              onClick={copyRoomCode}
              title="Click to copy Room Link"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-cyan-500/40 text-xs font-mono text-cyan-300 cursor-pointer hover:bg-slate-800 transition-colors"
            >
              <Radio size={12} className="text-cyan-400" />
              <span>SECTOR: {roomCode}</span>
              <Copy size={12} className="text-slate-400" />
            </div>
          )}

          {gameMode === 'ai' && (
            <div className="px-2.5 py-1 rounded bg-fuchsia-950/60 border border-fuchsia-500/40 text-xs font-mono text-fuchsia-300">
              AI: {aiDifficulty.toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Draw offer banner if pending from opponent */}
          {drawOfferFrom && drawOfferFrom !== myRole && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-950/80 border border-amber-500 rounded-lg animate-pulse text-xs font-mono text-amber-200">
              <span>Opponent offers Draw</span>
              <button
                onClick={() => respondDraw(true)}
                className="px-2 py-0.5 bg-emerald-600 rounded text-black font-bold text-[10px]"
              >
                ACCEPT
              </button>
              <button
                onClick={() => respondDraw(false)}
                className="px-2 py-0.5 bg-red-600 rounded text-white font-bold text-[10px]"
              >
                REJECT
              </button>
            </div>
          )}

          <button
            onClick={toggleSound}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:text-cyan-400 transition-colors text-slate-400"
            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button
            onClick={() => setStatus('init')}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-red-500 text-xs font-cyber text-slate-300 hover:text-red-400 transition-colors"
          >
            EXIT MATRIX
          </button>
        </div>
      </header>

      {/* Main Tactical Layout: Board Center, Comms & Controls on Side */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Center Arena: Clocks + Board */}
        <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 overflow-y-auto">
          {/* Opponent Info Header */}
          <div className="w-full max-w-[520px] flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-cyber font-bold text-sm border shadow-lg ${
                  opponent?.color === 'w'
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                    : 'bg-fuchsia-950 border-fuchsia-400 text-fuchsia-300'
                }`}
              >
                {opponent?.name ? opponent.name.charAt(0).toUpperCase() : 'O'}
              </div>
              <div>
                <div className="text-xs font-mono font-bold text-slate-200">
                  {opponent?.name || (gameMode === 'ai' ? 'Tactical Bot' : 'Waiting...')}
                </div>
                <div className="text-[10px] font-cyber text-slate-400">
                  {opponent?.color === 'w' ? 'WHITE OPERATOR' : 'BLACK OPERATOR'}
                </div>
              </div>
            </div>

            {/* Opponent Timer */}
            <TimerDisplay
              color={opponent?.color === 'w' ? 'w' : 'b'}
              playerName={opponent?.name || 'Opponent'}
              timeRemainingMs={opponent?.color === 'w' ? timeControl.whiteRemainingMs : timeControl.blackRemainingMs}
              totalTimeMinutes={timeControl.initialMinutes}
              isActive={status === 'playing' && game.turn() === opponent?.color}
            />
          </div>

          {/* Holographic Chessboard */}
          <ChessBoard
            game={displayedGame}
            orientation={boardOrientation}
            onMove={handleBoardMove}
            lastMove={lastMove}
            interactive={isMyTurn()}
            disabledReason={
              isReviewing
                ? 'Reviewing move history'
                : !opponent?.connected && gameMode === 'online'
                ? 'Opponent signal disconnected'
                : !isMyTurn()
                ? 'Awaiting opponent move...'
                : undefined
            }
            onFlipOrientation={() => setBoardOrientation((prev) => (prev === 'w' ? 'b' : 'w'))}
          />

          {/* Self Info Header */}
          <div className="w-full max-w-[520px] flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-cyber font-bold text-sm border shadow-lg ${
                  myRole === 'w'
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                    : 'bg-fuchsia-950 border-fuchsia-400 text-fuchsia-300'
                }`}
              >
                {playerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-mono font-bold text-slate-200">
                  {playerName} <span className="text-cyan-400">(YOU)</span>
                </div>
                <div className="text-[10px] font-cyber text-slate-400">
                  {myRole === 'w' ? 'WHITE OPERATOR' : myRole === 'b' ? 'BLACK OPERATOR' : 'SPECTATOR'}
                </div>
              </div>
            </div>

            {/* Self Timer */}
            <TimerDisplay
              color={myRole === 'w' ? 'w' : 'b'}
              playerName={playerName}
              timeRemainingMs={myRole === 'w' ? timeControl.whiteRemainingMs : timeControl.blackRemainingMs}
              totalTimeMinutes={timeControl.initialMinutes}
              isActive={status === 'playing' && game.turn() === myRole}
            />
          </div>
        </div>

        {/* Right Tactical Sidebar: Move Log, Tactical Actions & Holo-Chat */}
        <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#070c18] flex flex-col h-72 lg:h-auto z-10">
          {/* Move Log & Playback */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-cyber text-slate-300 flex items-center gap-1.5 font-bold">
                <History size={14} className="text-cyan-400" />
                <span>TACTICAL MOVE LOG</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                TURN {Math.floor(history.length / 2) + 1}
              </span>
            </div>

            {/* Move steps review bar */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleReviewStep('prev')}
                disabled={history.length === 0}
                className="p-1 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500 text-slate-300 disabled:opacity-30"
                title="Previous Move"
              >
                <ChevronLeft size={14} />
              </button>

              <div className="flex-1 text-center text-[11px] font-mono text-slate-300 py-1 bg-slate-900/60 rounded border border-slate-800">
                {isReviewing ? `Replay: Move ${(historyIndex || 0) + 1} / ${history.length}` : 'LIVE REAL-TIME'}
              </div>

              <button
                onClick={() => handleReviewStep('next')}
                disabled={historyIndex === null}
                className="p-1 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500 text-slate-300 disabled:opacity-30"
                title="Next Move"
              >
                <ChevronRight size={14} />
              </button>

              {isReviewing && (
                <button
                  onClick={() => handleReviewStep('current')}
                  className="px-2 py-1 rounded bg-cyan-950 border border-cyan-400 text-cyan-300 text-[10px] font-cyber"
                >
                  LIVE
                </button>
              )}
            </div>

            {/* Move history chips */}
            <div className="mt-2 max-h-24 overflow-y-auto grid grid-cols-2 gap-1 text-[11px] font-mono pr-1">
              {history.map((san, idx) => {
                const moveNum = Math.floor(idx / 2) + 1;
                const isWhite = idx % 2 === 0;
                const isSelected = historyIndex === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => setHistoryIndex(idx)}
                    className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-400'
                        : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-slate-500 mr-1">{isWhite ? `${moveNum}.` : ''}</span>
                    <span>{san}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Protocols: Resign, Offer Draw */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/20 flex gap-2">
            <button
              onClick={offerDraw}
              disabled={status !== 'playing'}
              className="flex-1 py-1.5 px-2 rounded bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-amber-300 font-cyber text-[11px] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Handshake size={14} />
              <span>OFFER DRAW</span>
            </button>

            <button
              onClick={resignGame}
              disabled={status !== 'playing'}
              className="flex-1 py-1.5 px-2 rounded bg-red-950/30 border border-red-800/80 hover:bg-red-900/50 text-red-300 font-cyber text-[11px] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Flag size={14} />
              <span>SURRENDER</span>
            </button>
          </div>

          {/* Real-time Holo-Comms */}
          <div className="flex-1 p-2 overflow-hidden flex flex-col">
            <CyberChat
              messages={chatMessages}
              onSendMessage={sendChatMessage}
              disabled={status !== 'playing' && status !== 'checkmate' && status !== 'draw'}
            />
          </div>
        </aside>
      </div>

      {/* Game Over Modal */}
      {['checkmate', 'draw', 'stalemate', 'resigned', 'timeout'].includes(status) && (
        <GameOverModal
          status={status}
          winner={winner}
          myColor={myRole}
          rematchVotes={rematchVotes}
          onVoteRematch={voteRematch}
          onExitLobby={() => setStatus('init')}
          onDismiss={() => setIsGameOverDismissed(true)}
          isDismissed={isGameOverDismissed}
        />
      )}
    </div>
  );
};

export default App;
