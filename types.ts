import { Square, Move } from 'chess.js';

export type PlayerColor = 'w' | 'b';
export type PlayerRole = 'w' | 'b' | 'spectator';

export interface Player {
  id: string;
  name: string;
  color: PlayerRole;
  connected: boolean;
}

export type RoomStatus = 
  | 'init'
  | 'lobby'
  | 'playing'
  | 'checkmate'
  | 'draw'
  | 'stalemate'
  | 'resigned'
  | 'timeout'
  | 'abandoned';

export interface TimeControl {
  initialMinutes: number;
  incrementSeconds: number;
  whiteRemainingMs: number;
  blackRemainingMs: number;
  lastTurnStartTime: number | null;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  color?: string;
  isSystem?: boolean;
}

export interface MoveRecord {
  from: string;
  to: string;
  san: string;
  color: PlayerColor;
  captured?: string;
  piece: string;
  timestamp: number;
}

export interface RoomState {
  roomCode: string;
  white: Player | null;
  black: Player | null;
  spectators: Player[];
  fen: string;
  turn: PlayerColor;
  history: string[];
  moveHistory: MoveRecord[];
  lastMove: { from: Square; to: Square; san: string } | null;
  inCheck: boolean;
  status: RoomStatus;
  winner: PlayerColor | 'draw' | null;
  drawOfferFrom: PlayerColor | null;
  rematchVotes: { w: boolean; b: boolean };
  timeControl: TimeControl;
  chatMessages: ChatMessage[];
}

export interface PublicRoomSummary {
  roomCode: string;
  hostName: string;
  playersCount: number;
  status: RoomStatus;
  initialMinutes: number;
}

export type ClientMessageType =
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'QUICK_MATCH'
  | 'CANCEL_QUICK_MATCH'
  | 'MOVE'
  | 'RESIGN'
  | 'OFFER_DRAW'
  | 'RESPOND_DRAW'
  | 'VOTE_REMATCH'
  | 'CHAT'
  | 'GET_ROOMS'
  | 'PING';

export type ServerMessageType =
  | 'ROOM_CREATED'
  | 'ROOM_JOINED'
  | 'ROOM_UPDATE'
  | 'MOVE_MADE'
  | 'CHAT_MESSAGE'
  | 'ERROR'
  | 'MATCHMAKING_STATUS'
  | 'ROOM_LIST'
  | 'PONG';

export interface WSMessage<T = any> {
  type: ClientMessageType | ServerMessageType;
  payload?: T;
}

export type GameMode = 'online' | 'ai' | 'pass-and-play';
export type AIDifficulty = 'novice' | 'tactical' | 'master';
