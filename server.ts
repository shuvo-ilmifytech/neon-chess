import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { Chess } from 'chess.js';
import {
  Player,
  PlayerColor,
  PlayerRole,
  RoomState,
  RoomStatus,
  WSMessage,
  ChatMessage,
  MoveRecord,
  PublicRoomSummary
} from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json());

interface ConnectedSocket extends WebSocket {
  playerId?: string;
  playerName?: string;
  currentRoomCode?: string;
  isAlive?: boolean;
}

interface InternalPlayer {
  id: string;
  name: string;
  color: PlayerRole;
  ws: ConnectedSocket | null;
  connected: boolean;
}

interface InternalRoom {
  roomCode: string;
  chess: Chess;
  white: InternalPlayer | null;
  black: InternalPlayer | null;
  spectators: InternalPlayer[];
  history: string[];
  moveHistory: MoveRecord[];
  lastMove: { from: any; to: any; san: string } | null;
  status: RoomStatus;
  winner: PlayerColor | 'draw' | null;
  drawOfferFrom: PlayerColor | null;
  rematchVotes: { w: boolean; b: boolean };
  timeControl: {
    initialMinutes: number;
    incrementSeconds: number;
    whiteRemainingMs: number;
    blackRemainingMs: number;
    lastTurnStartTime: number | null;
  };
  chatMessages: ChatMessage[];
  lastActivity: number;
  timerInterval?: NodeJS.Timeout;
}

const rooms = new Map<string, InternalRoom>();
const matchmakingQueue: { ws: ConnectedSocket; name: string; playerId: string }[] = [];

function sanitizeRoomCode(code: string): string {
  return (code || '').trim().toUpperCase();
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'CYBER-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function serializeRoomState(room: InternalRoom): RoomState {
  return {
    roomCode: room.roomCode,
    white: room.white ? {
      id: room.white.id,
      name: room.white.name,
      color: 'w',
      connected: room.white.connected
    } : null,
    black: room.black ? {
      id: room.black.id,
      name: room.black.name,
      color: 'b',
      connected: room.black.connected
    } : null,
    spectators: room.spectators.map(s => ({
      id: s.id,
      name: s.name,
      color: 'spectator',
      connected: s.connected
    })),
    fen: room.chess.fen(),
    turn: room.chess.turn(),
    history: [...room.history],
    moveHistory: [...room.moveHistory],
    lastMove: room.lastMove,
    inCheck: room.chess.inCheck(),
    status: room.status,
    winner: room.winner,
    drawOfferFrom: room.drawOfferFrom,
    rematchVotes: { ...room.rematchVotes },
    timeControl: { ...room.timeControl },
    chatMessages: [...room.chatMessages]
  };
}

function broadcastToRoom(room: InternalRoom, message: WSMessage) {
  const data = JSON.stringify(message);
  const sockets = [
    room.white?.ws,
    room.black?.ws,
    ...room.spectators.map(s => s.ws)
  ];

  for (const ws of sockets) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function addSystemMessage(room: InternalRoom, text: string) {
  const msg: ChatMessage = {
    id: 'sys-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    sender: 'NEON CORE',
    text,
    timestamp: Date.now(),
    isSystem: true
  };
  room.chatMessages.push(msg);
  if (room.chatMessages.length > 50) {
    room.chatMessages.shift();
  }
  broadcastToRoom(room, {
    type: 'CHAT_MESSAGE',
    payload: msg
  });
}

function updateRoomTimer(room: InternalRoom) {
  if (room.status !== 'playing') return;
  if (room.timeControl.initialMinutes <= 0) return; // Untimed
  if (!room.timeControl.lastTurnStartTime) return;

  const now = Date.now();
  const elapsed = now - room.timeControl.lastTurnStartTime;
  room.timeControl.lastTurnStartTime = now;

  const currentTurn = room.chess.turn();
  if (currentTurn === 'w') {
    room.timeControl.whiteRemainingMs = Math.max(0, room.timeControl.whiteRemainingMs - elapsed);
    if (room.timeControl.whiteRemainingMs <= 0) {
      room.status = 'timeout';
      room.winner = 'b';
      addSystemMessage(room, 'TIME EXPIRED: White operator ran out of clock cycles. Black wins.');
      broadcastToRoom(room, {
        type: 'ROOM_UPDATE',
        payload: { state: serializeRoomState(room) }
      });
      clearInterval(room.timerInterval);
    }
  } else {
    room.timeControl.blackRemainingMs = Math.max(0, room.timeControl.blackRemainingMs - elapsed);
    if (room.timeControl.blackRemainingMs <= 0) {
      room.status = 'timeout';
      room.winner = 'w';
      addSystemMessage(room, 'TIME EXPIRED: Black operator ran out of clock cycles. White wins.');
      broadcastToRoom(room, {
        type: 'ROOM_UPDATE',
        payload: { state: serializeRoomState(room) }
      });
      clearInterval(room.timerInterval);
    }
  }
}

function startRoomTicker(room: InternalRoom) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  if (room.timeControl.initialMinutes <= 0) return;

  room.timerInterval = setInterval(() => {
    if (room.status !== 'playing') {
      clearInterval(room.timerInterval);
      return;
    }
    updateRoomTimer(room);
  }, 1000);
}

function createRoomInstance(
  roomCode: string,
  initialMinutes: number = 10,
  incrementSeconds: number = 0
): InternalRoom {
  const room: InternalRoom = {
    roomCode,
    chess: new Chess(),
    white: null,
    black: null,
    spectators: [],
    history: [],
    moveHistory: [],
    lastMove: null,
    status: 'lobby',
    winner: null,
    drawOfferFrom: null,
    rematchVotes: { w: false, b: false },
    timeControl: {
      initialMinutes,
      incrementSeconds,
      whiteRemainingMs: initialMinutes * 60 * 1000,
      blackRemainingMs: initialMinutes * 60 * 1000,
      lastTurnStartTime: null
    },
    chatMessages: [],
    lastActivity: Date.now()
  };
  rooms.set(roomCode, room);
  return room;
}

// REST Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'NEON GAMBIT CYBER CORE',
    activeRooms: rooms.size,
    matchmakingQueue: matchmakingQueue.length,
    timestamp: Date.now()
  });
});

app.get('/api/rooms', (req, res) => {
  const list: PublicRoomSummary[] = [];
  for (const [code, r] of rooms.entries()) {
    if (r.status === 'lobby' || (r.status === 'playing' && (!r.white || !r.black))) {
      list.push({
        roomCode: code,
        hostName: r.white?.name || r.black?.name || 'Unknown Operator',
        playersCount: (r.white ? 1 : 0) + (r.black ? 1 : 0),
        status: r.status,
        initialMinutes: r.timeControl.initialMinutes
      });
    }
  }
  res.json(list.slice(0, 10));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: ConnectedSocket) => {
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw: string) => {
    try {
      const msg: WSMessage = JSON.parse(raw.toString());
      handleClientMessage(ws, msg);
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    handleSocketDisconnect(ws);
  });
});

// Periodic ping to keep connections healthy through reverse proxies
const heartbeatInterval = setInterval(() => {
  for (const ws of wss.clients as Set<ConnectedSocket>) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

function handleSocketDisconnect(ws: ConnectedSocket) {
  // Remove from matchmaking queue
  const qIndex = matchmakingQueue.findIndex(item => item.ws === ws);
  if (qIndex !== -1) {
    matchmakingQueue.splice(qIndex, 1);
  }

  const roomCode = ws.currentRoomCode;
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) return;

  let playerColor: PlayerRole | null = null;
  if (room.white && room.white.ws === ws) {
    room.white.connected = false;
    playerColor = 'w';
  } else if (room.black && room.black.ws === ws) {
    room.black.connected = false;
    playerColor = 'b';
  } else {
    const specIdx = room.spectators.findIndex(s => s.ws === ws);
    if (specIdx !== -1) {
      room.spectators[specIdx].connected = false;
      playerColor = 'spectator';
    }
  }

  if (playerColor) {
    addSystemMessage(room, `Signal lost for ${ws.playerName || 'player'} (${playerColor === 'w' ? 'WHITE' : playerColor === 'b' ? 'BLACK' : 'SPECTATOR'}). Reconnection window open.`);
    broadcastToRoom(room, {
      type: 'ROOM_UPDATE',
      payload: { state: serializeRoomState(room) }
    });
  }
}

function handleClientMessage(ws: ConnectedSocket, msg: WSMessage) {
  const { type, payload } = msg;

  switch (type) {
    case 'PING': {
      ws.send(JSON.stringify({ type: 'PONG' }));
      break;
    }

    case 'CREATE_ROOM': {
      const name = (payload?.name || 'Cyber Operator').trim().slice(0, 20);
      const playerId = payload?.playerId || 'p-' + Math.random().toString(36).substring(2, 9);
      const requestedMinutes = typeof payload?.timeMinutes === 'number' ? payload.timeMinutes : 10;
      const customCode = payload?.customRoomCode ? sanitizeRoomCode(payload.customRoomCode) : '';
      
      let roomCode = customCode;
      if (!roomCode || rooms.has(roomCode)) {
        roomCode = generateRoomCode();
        while (rooms.has(roomCode)) {
          roomCode = generateRoomCode();
        }
      }

      const room = createRoomInstance(roomCode, requestedMinutes, 0);
      const preferredColor = payload?.preferredColor || 'w';
      
      let assignedColor: PlayerColor = 'w';
      if (preferredColor === 'b') assignedColor = 'b';
      else if (preferredColor === 'random') assignedColor = Math.random() < 0.5 ? 'w' : 'b';

      const player: InternalPlayer = {
        id: playerId,
        name,
        color: assignedColor,
        ws,
        connected: true
      };

      if (assignedColor === 'w') {
        room.white = player;
      } else {
        room.black = player;
      }

      ws.playerId = playerId;
      ws.playerName = name;
      ws.currentRoomCode = roomCode;

      addSystemMessage(room, `Tactical Matrix initialized by ${name} [${assignedColor === 'w' ? 'WHITE' : 'BLACK'}]. Code: ${roomCode}`);

      ws.send(JSON.stringify({
        type: 'ROOM_CREATED',
        payload: {
          roomCode,
          role: assignedColor,
          state: serializeRoomState(room)
        }
      }));
      break;
    }

    case 'JOIN_ROOM': {
      const inputCode = sanitizeRoomCode(payload?.roomCode || '');
      const name = (payload?.name || 'Combatant').trim().slice(0, 20);
      const playerId = payload?.playerId || 'p-' + Math.random().toString(36).substring(2, 9);

      if (!inputCode) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { code: 'INVALID_CODE', message: 'Please provide a valid Room Access Code.' }
        }));
        return;
      }

      const room = rooms.get(inputCode);
      if (!room) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: {
            code: 'ROOM_NOT_FOUND',
            message: `Matrix signal not found: Room '${inputCode}' is offline or does not exist.`,
            attemptedCode: inputCode
          }
        }));
        return;
      }

      ws.playerId = playerId;
      ws.playerName = name;
      ws.currentRoomCode = inputCode;

      let role: PlayerRole = 'spectator';

      // Check for reconnecting existing player
      if (room.white && (room.white.id === playerId || room.white.name === name)) {
        room.white.ws = ws;
        room.white.connected = true;
        role = 'w';
        addSystemMessage(room, `White operator ${name} re-established cyber link.`);
      } else if (room.black && (room.black.id === playerId || room.black.name === name)) {
        room.black.ws = ws;
        room.black.connected = true;
        role = 'b';
        addSystemMessage(room, `Black operator ${name} re-established cyber link.`);
      } else if (!room.white) {
        room.white = { id: playerId, name, color: 'w', ws, connected: true };
        role = 'w';
        addSystemMessage(room, `${name} linked as WHITE operator.`);
      } else if (!room.black) {
        room.black = { id: playerId, name, color: 'b', ws, connected: true };
        role = 'b';
        addSystemMessage(room, `${name} linked as BLACK operator.`);
      } else {
        // Both seats taken -> Spectator
        role = 'spectator';
        room.spectators.push({ id: playerId, name, color: 'spectator', ws, connected: true });
        addSystemMessage(room, `${name} joined holographic spectator feed.`);
      }

      // Check if both players are present to begin game
      if (room.white?.connected && room.black?.connected && (room.status === 'lobby' || room.status === 'init')) {
        room.status = 'playing';
        room.timeControl.lastTurnStartTime = Date.now();
        startRoomTicker(room);
        addSystemMessage(room, 'COMBAT INITIATED: White opens. May the superior strategist prevail.');
      }

      ws.send(JSON.stringify({
        type: 'ROOM_JOINED',
        payload: {
          roomCode: inputCode,
          role,
          state: serializeRoomState(room)
        }
      }));

      broadcastToRoom(room, {
        type: 'ROOM_UPDATE',
        payload: { state: serializeRoomState(room) }
      });
      break;
    }

    case 'QUICK_MATCH': {
      const name = (payload?.name || 'Quick Combatant').trim().slice(0, 20);
      const playerId = payload?.playerId || 'p-' + Math.random().toString(36).substring(2, 9);

      ws.playerId = playerId;
      ws.playerName = name;

      // Find waiting opponent in queue
      while (matchmakingQueue.length > 0) {
        const candidate = matchmakingQueue.shift()!;
        if (candidate.ws.readyState === WebSocket.OPEN && candidate.ws !== ws) {
          // Form match!
          const roomCode = generateRoomCode();
          const room = createRoomInstance(roomCode, 5, 0); // 5 min blitz

          const isCandidateWhite = Math.random() < 0.5;
          const whiteParticipant = isCandidateWhite ? candidate : { ws, name, playerId };
          const blackParticipant = isCandidateWhite ? { ws, name, playerId } : candidate;

          room.white = {
            id: whiteParticipant.playerId,
            name: whiteParticipant.name,
            color: 'w',
            ws: whiteParticipant.ws,
            connected: true
          };

          room.black = {
            id: blackParticipant.playerId,
            name: blackParticipant.name,
            color: 'b',
            ws: blackParticipant.ws,
            connected: true
          };

          whiteParticipant.ws.currentRoomCode = roomCode;
          blackParticipant.ws.currentRoomCode = roomCode;

          room.status = 'playing';
          room.timeControl.lastTurnStartTime = Date.now();
          startRoomTicker(room);

          addSystemMessage(room, `MATCH ESTABLISHED: ${room.white.name} (White) vs ${room.black.name} (Black).`);

          whiteParticipant.ws.send(JSON.stringify({
            type: 'ROOM_JOINED',
            payload: { roomCode, role: 'w', state: serializeRoomState(room) }
          }));

          blackParticipant.ws.send(JSON.stringify({
            type: 'ROOM_JOINED',
            payload: { roomCode, role: 'b', state: serializeRoomState(room) }
          }));
          return;
        }
      }

      // No opponent available yet, join queue
      matchmakingQueue.push({ ws, name, playerId });
      ws.send(JSON.stringify({
        type: 'MATCHMAKING_STATUS',
        payload: { inQueue: true, queueCount: matchmakingQueue.length }
      }));
      break;
    }

    case 'CANCEL_QUICK_MATCH': {
      const idx = matchmakingQueue.findIndex(item => item.ws === ws);
      if (idx !== -1) {
        matchmakingQueue.splice(idx, 1);
      }
      ws.send(JSON.stringify({
        type: 'MATCHMAKING_STATUS',
        payload: { inQueue: false, queueCount: matchmakingQueue.length }
      }));
      break;
    }

    case 'MOVE': {
      const roomCode = ws.currentRoomCode;
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room || room.status !== 'playing') {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { code: 'INVALID_STATE', message: 'Combat is not actively in session.' }
        }));
        return;
      }

      const senderColor: PlayerColor | null = 
        room.white?.ws === ws ? 'w' :
        room.black?.ws === ws ? 'b' : null;

      if (!senderColor || room.chess.turn() !== senderColor) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { code: 'NOT_YOUR_TURN', message: 'Awaiting opponent tactical execution.' }
        }));
        return;
      }

      const { from, to, promotion } = payload || {};
      try {
        const move = room.chess.move({ from, to, promotion: promotion || 'q' });
        if (!move) {
          ws.send(JSON.stringify({
            type: 'ERROR',
            payload: { code: 'ILLEGAL_MOVE', message: 'Illegal tactical vector.' }
          }));
          return;
        }

        // Apply time calculation and increment
        if (room.timeControl.initialMinutes > 0 && room.timeControl.lastTurnStartTime) {
          const now = Date.now();
          const elapsed = now - room.timeControl.lastTurnStartTime;
          if (senderColor === 'w') {
            room.timeControl.whiteRemainingMs = Math.max(0, room.timeControl.whiteRemainingMs - elapsed + (room.timeControl.incrementSeconds * 1000));
          } else {
            room.timeControl.blackRemainingMs = Math.max(0, room.timeControl.blackRemainingMs - elapsed + (room.timeControl.incrementSeconds * 1000));
          }
          room.timeControl.lastTurnStartTime = now;
        }

        const moveRecord: MoveRecord = {
          from: move.from,
          to: move.to,
          san: move.san,
          color: senderColor,
          captured: move.captured,
          piece: move.piece,
          timestamp: Date.now()
        };

        room.history.push(move.san);
        room.moveHistory.push(moveRecord);
        room.lastMove = { from: move.from, to: move.to, san: move.san };
        room.drawOfferFrom = null; // Clear draw offer upon move

        // Game Over Evaluations
        if (room.chess.isGameOver()) {
          if (room.chess.isCheckmate()) {
            room.status = 'checkmate';
            room.winner = senderColor;
            addSystemMessage(room, `CHECKMATE EXECUTED: ${senderColor === 'w' ? 'White' : 'Black'} has neutralized the opponent King!`);
          } else if (room.chess.isStalemate()) {
            room.status = 'stalemate';
            room.winner = 'draw';
            addSystemMessage(room, 'STALEMATE DETECTED: No legal tactical moves remain.');
          } else if (room.chess.isThreefoldRepetition()) {
            room.status = 'draw';
            room.winner = 'draw';
            addSystemMessage(room, 'DRAW: Threefold repetition confirmed by neural core.');
          } else if (room.chess.isInsufficientMaterial()) {
            room.status = 'draw';
            room.winner = 'draw';
            addSystemMessage(room, 'DRAW: Insufficient material to execute checkmate.');
          } else {
            room.status = 'draw';
            room.winner = 'draw';
            addSystemMessage(room, 'DRAW: Combat ended in stalemate or 50-move rule.');
          }
          if (room.timerInterval) clearInterval(room.timerInterval);
        } else if (room.chess.inCheck()) {
          addSystemMessage(room, `WARNING: ${room.chess.turn() === 'w' ? 'White' : 'Black'} King is in CHECK!`);
        }

        broadcastToRoom(room, {
          type: 'MOVE_MADE',
          payload: {
            move: moveRecord,
            state: serializeRoomState(room)
          }
        });
      } catch (err: any) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { code: 'MOVE_EXCEPTION', message: err.message || 'Move calculation failed.' }
        }));
      }
      break;
    }

    case 'OFFER_DRAW': {
      const roomCode = ws.currentRoomCode;
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room || room.status !== 'playing') return;

      const senderColor = room.white?.ws === ws ? 'w' : room.black?.ws === ws ? 'b' : null;
      if (!senderColor) return;

      room.drawOfferFrom = senderColor;
      addSystemMessage(room, `${senderColor === 'w' ? 'White' : 'Black'} operator offered mutual peace protocols (Draw).`);

      broadcastToRoom(room, {
        type: 'ROOM_UPDATE',
        payload: { state: serializeRoomState(room) }
      });
      break;
    }

    case 'RESPOND_DRAW': {
      const roomCode = ws.currentRoomCode;
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room || room.status !== 'playing' || !room.drawOfferFrom) return;

      const senderColor = room.white?.ws === ws ? 'w' : room.black?.ws === ws ? 'b' : null;
      if (!senderColor || senderColor === room.drawOfferFrom) return;

      if (payload?.accept) {
        room.status = 'draw';
        room.winner = 'draw';
        room.drawOfferFrom = null;
        if (room.timerInterval) clearInterval(room.timerInterval);
        addSystemMessage(room, 'MUTUAL DRAW ACCEPTED: Both operators concluded hostilities in ceasefire.');
      } else {
        const off = room.drawOfferFrom;
        room.drawOfferFrom = null;
        addSystemMessage(room, `${senderColor === 'w' ? 'White' : 'Black'} rejected draw offer from ${off === 'w' ? 'White' : 'Black'}.`);
      }

      broadcastToRoom(room, {
        type: 'ROOM_UPDATE',
        payload: { state: serializeRoomState(room) }
      });
      break;
    }

    case 'RESIGN': {
      const roomCode = ws.currentRoomCode;
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room || room.status !== 'playing') return;

      const senderColor = room.white?.ws === ws ? 'w' : room.black?.ws === ws ? 'b' : null;
      if (!senderColor) return;

      room.status = 'resigned';
      room.winner = senderColor === 'w' ? 'b' : 'w';
      if (room.timerInterval) clearInterval(room.timerInterval);

      addSystemMessage(room, `${senderColor === 'w' ? 'White' : 'Black'} has surrendered. Victory goes to ${room.winner === 'w' ? 'White' : 'Black'}!`);

      broadcastToRoom(room, {
        type: 'ROOM_UPDATE',
        payload: { state: serializeRoomState(room) }
      });
      break;
    }

    case 'VOTE_REMATCH': {
      const roomCode = ws.currentRoomCode;
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;

      const senderColor = room.white?.ws === ws ? 'w' : room.black?.ws === ws ? 'b' : null;
      if (!senderColor) return;

      room.rematchVotes[senderColor] = true;
      addSystemMessage(room, `${senderColor === 'w' ? 'White' : 'Black'} requested a Rematch.`);

      if (room.rematchVotes.w && room.rematchVotes.b) {
        // Swap colors for rematch
        const prevWhite = room.white;
        const prevBlack = room.black;

        if (prevWhite && prevBlack) {
          prevWhite.color = 'b';
          prevBlack.color = 'w';
          room.white = prevBlack;
          room.black = prevWhite;
        }

        room.chess = new Chess();
        room.history = [];
        room.moveHistory = [];
        room.lastMove = null;
        room.status = 'playing';
        room.winner = null;
        room.drawOfferFrom = null;
        room.rematchVotes = { w: false, b: false };

        const mins = room.timeControl.initialMinutes;
        room.timeControl.whiteRemainingMs = mins * 60 * 1000;
        room.timeControl.blackRemainingMs = mins * 60 * 1000;
        room.timeControl.lastTurnStartTime = Date.now();
        startRoomTicker(room);

        addSystemMessage(room, `REMATCH INITIATED! Roles swapped: ${room.white?.name} (White) vs ${room.black?.name} (Black).`);
      }

      broadcastToRoom(room, {
        type: 'ROOM_UPDATE',
        payload: { state: serializeRoomState(room) }
      });
      break;
    }

    case 'CHAT': {
      const roomCode = ws.currentRoomCode;
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;

      const text = (payload?.text || '').trim().slice(0, 140);
      if (!text) return;

      const senderColor = room.white?.ws === ws ? 'w' : room.black?.ws === ws ? 'b' : 'spectator';
      const senderName = ws.playerName || (senderColor === 'w' ? 'White' : senderColor === 'b' ? 'Black' : 'Spectator');

      const chatMsg: ChatMessage = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        sender: senderName,
        text,
        timestamp: Date.now(),
        color: senderColor === 'w' ? '#22d3ee' : senderColor === 'b' ? '#e879f9' : '#94a3b8'
      };

      room.chatMessages.push(chatMsg);
      if (room.chatMessages.length > 60) room.chatMessages.shift();

      broadcastToRoom(room, {
        type: 'CHAT_MESSAGE',
        payload: chatMsg
      });
      break;
    }

    case 'GET_ROOMS': {
      const list: PublicRoomSummary[] = [];
      for (const [code, r] of rooms.entries()) {
        if (r.status === 'lobby' || (r.status === 'playing' && (!r.white || !r.black))) {
          list.push({
            roomCode: code,
            hostName: r.white?.name || r.black?.name || 'Anonymous',
            playersCount: (r.white ? 1 : 0) + (r.black ? 1 : 0),
            status: r.status,
            initialMinutes: r.timeControl.initialMinutes
          });
        }
      }
      ws.send(JSON.stringify({
        type: 'ROOM_LIST',
        payload: { rooms: list }
      }));
      break;
    }
  }
}

// Vite mounting: Middleware in dev, Static in prod
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.use((req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[NEON GAMBIT CORE] Server active on port ${PORT} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch(err => {
  console.error('Fatal server boot failure:', err);
});
