import React, { useState } from 'react';
import { Chess, Square, Move } from 'chess.js';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, ShieldAlert, Sparkles } from 'lucide-react';
import { FILES, RANKS, PIECE_UNICODE } from '../constants';
import { PlayerColor } from '../types';
import { sfx } from '../utils/sound';

interface ChessBoardProps {
  game: Chess;
  orientation: PlayerColor;
  onMove: (from: Square, to: Square, promotion?: string) => void;
  lastMove: { from: Square; to: Square; san: string } | null;
  interactive: boolean;
  disabledReason?: string;
  onFlipOrientation?: () => void;
}

interface PendingPromotion {
  from: Square;
  to: Square;
}

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

export const ChessBoard: React.FC<ChessBoardProps> = ({
  game,
  orientation,
  onMove,
  lastMove,
  interactive,
  disabledReason,
  onFlipOrientation
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Move[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  // Compute ranks and files based on perspective
  const ranks = orientation === 'w' ? [...RANKS] : [...RANKS].reverse();
  const files = orientation === 'w' ? [...FILES] : [...FILES].reverse();

  // Compute captured pieces and material count
  const allInitialPieces: Record<string, number> = {
    p: 8, r: 2, n: 2, b: 2, q: 1,
    P: 8, R: 2, N: 2, B: 2, Q: 1
  };

  const currentBoard = game.board();
  const currentPieces: Record<string, number> = {
    p: 0, r: 0, n: 0, b: 0, q: 0,
    P: 0, R: 0, N: 0, B: 0, Q: 0
  };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = currentBoard[r][c];
      if (p && p.type !== 'k') {
        const key = p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
        currentPieces[key] = (currentPieces[key] || 0) + 1;
      }
    }
  }

  const whiteCaptured: string[] = []; // Black captured white pieces
  const blackCaptured: string[] = []; // White captured black pieces

  let whiteMaterial = 0;
  let blackMaterial = 0;

  ['P', 'N', 'B', 'R', 'Q'].forEach((type) => {
    const missing = (allInitialPieces[type] || 0) - (currentPieces[type] || 0);
    for (let i = 0; i < missing; i++) blackCaptured.push(type);
    whiteMaterial += (currentPieces[type] || 0) * (PIECE_VALUES[type.toLowerCase()] || 0);
  });

  ['p', 'n', 'b', 'r', 'q'].forEach((type) => {
    const missing = (allInitialPieces[type] || 0) - (currentPieces[type] || 0);
    for (let i = 0; i < missing; i++) whiteCaptured.push(type);
    blackMaterial += (currentPieces[type] || 0) * (PIECE_VALUES[type] || 0);
  });

  const materialDiff = whiteMaterial - blackMaterial;

  const handleSquareClick = (square: Square) => {
    if (!interactive || pendingPromotion) return;

    // Check if clicked square is a legal destination
    const targetMove = possibleMoves.find((m) => m.to === square);
    if (selectedSquare && targetMove) {
      // Check for promotion
      const piece = game.get(selectedSquare);
      const isPawn = piece?.type === 'p';
      const isPromotionRank = (piece?.color === 'w' && square[1] === '8') || (piece?.color === 'b' && square[1] === '1');

      if (isPawn && isPromotionRank) {
        setPendingPromotion({ from: selectedSquare, to: square });
        return;
      }

      onMove(selectedSquare, square, 'q');
      setSelectedSquare(null);
      setPossibleMoves([]);
      return;
    }

    // Check if clicking own piece
    const piece = game.get(square);
    if (piece && piece.color === game.turn() && piece.color === orientation) {
      sfx.playClick();
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true }) as Move[];
      setPossibleMoves(moves);
    } else {
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  };

  const handleSelectPromotion = (promoPiece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    onMove(pendingPromotion.from, pendingPromotion.to, promoPiece);
    setPendingPromotion(null);
    setSelectedSquare(null);
    setPossibleMoves([]);
  };

  const getPieceGlow = (color: 'w' | 'b') => {
    return color === 'w'
      ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]'
      : 'text-fuchsia-400 drop-shadow-[0_0_8px_rgba(232,121,249,0.8)]';
  };

  return (
    <div className="flex flex-col items-center select-none w-full max-w-[560px]">
      {/* Top Captured Material Bar */}
      <div className="w-full flex items-center justify-between px-2 py-1 mb-1 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
            {orientation === 'w' ? 'Black Losses:' : 'White Losses:'}
          </span>
          <div className="flex items-center gap-0.5 text-base leading-none">
            {(orientation === 'w' ? whiteCaptured : blackCaptured).map((p, idx) => (
              <span key={idx} className={p === p.toUpperCase() ? 'text-cyan-400' : 'text-fuchsia-400'}>
                {PIECE_UNICODE[p]}
              </span>
            ))}
          </div>
          {orientation === 'w' && materialDiff > 0 && (
            <span className="text-cyan-400 font-bold ml-1">+{materialDiff}</span>
          )}
          {orientation === 'b' && materialDiff < 0 && (
            <span className="text-fuchsia-400 font-bold ml-1">+{Math.abs(materialDiff)}</span>
          )}
        </div>

        {onFlipOrientation && (
          <button
            onClick={onFlipOrientation}
            title="Flip Board Perspective"
            className="flex items-center gap-1 text-[11px] font-cyber px-2 py-0.5 rounded bg-slate-800/80 text-cyan-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <RotateCcw size={12} />
            <span>FLIP</span>
          </button>
        )}
      </div>

      {/* Chess Grid Frame */}
      <div className="relative p-2.5 sm:p-3 bg-[#070b14]/90 border border-cyan-500/30 rounded-xl shadow-[0_0_40px_rgba(6,182,212,0.15)] backdrop-blur-md w-full aspect-square max-w-[520px]">
        {/* Hologram Corners */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400"></div>

        {/* Board Cells */}
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full border border-slate-800/80 rounded overflow-hidden">
          {ranks.map((rank, rIdx) =>
            files.map((file, fIdx) => {
              const square = `${file}${rank}` as Square;
              const isDark = (rIdx + fIdx) % 2 === 1;
              const piece = game.get(square);
              const isSelected = selectedSquare === square;
              const moveMatch = possibleMoves.find((m) => m.to === square);
              const isPossibleMove = !!moveMatch;
              const isCaptureMove = isPossibleMove && (!!piece || moveMatch.flags.includes('e'));
              const isLastMoveFrom = lastMove?.from === square;
              const isLastMoveTo = lastMove?.to === square;
              const inCheck = piece?.type === 'k' && piece?.color === game.turn() && game.inCheck();

              return (
                <div
                  key={square}
                  onClick={() => handleSquareClick(square)}
                  className={`
                    relative flex items-center justify-center cursor-pointer transition-colors duration-150
                    ${isDark ? 'bg-[#0f172a]/95' : 'bg-[#1e293b]/70'}
                    ${isSelected ? 'bg-cyan-950/80 ring-2 ring-inset ring-cyan-400 shadow-[inset_0_0_15px_rgba(34,211,238,0.5)]' : ''}
                    ${isLastMoveFrom || isLastMoveTo ? 'bg-fuchsia-950/40 ring-1 ring-inset ring-fuchsia-500/50' : ''}
                    ${inCheck ? 'bg-red-950/90 ring-2 ring-red-500 shadow-[inset_0_0_20px_rgba(239,68,68,0.7)] animate-pulse' : ''}
                  `}
                >
                  {/* Rank coordinates (left column) */}
                  {fIdx === 0 && (
                    <span className="absolute top-0.5 left-1 text-[9px] font-mono text-slate-500 pointer-events-none">
                      {rank}
                    </span>
                  )}

                  {/* File coordinates (bottom row) */}
                  {rIdx === 7 && (
                    <span className="absolute bottom-0.5 right-1 text-[9px] font-mono text-slate-500 pointer-events-none">
                      {file}
                    </span>
                  )}

                  {/* Move destination hint */}
                  {isPossibleMove && !isCaptureMove && (
                    <div className="absolute w-3 h-3 rounded-full bg-cyan-400/70 shadow-[0_0_8px_rgba(34,211,238,0.9)] pointer-events-none z-10 animate-pulse"></div>
                  )}

                  {/* Capture destination hint */}
                  {isCaptureMove && (
                    <div className="absolute inset-1 rounded-full border-2 border-red-400/90 shadow-[0_0_12px_rgba(248,113,113,0.8)] pointer-events-none z-10 animate-pulse"></div>
                  )}

                  {/* Piece Representation */}
                  <AnimatePresence mode="wait">
                    {piece && (
                      <motion.div
                        key={`${square}-${piece.color}-${piece.type}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                        className={`text-2xl sm:text-3xl md:text-4xl select-none z-20 transition-transform ${
                          isSelected ? 'scale-110' : 'hover:scale-105'
                        } ${getPieceGlow(piece.color)}`}
                      >
                        {PIECE_UNICODE[piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase()]}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Scanline pattern */}
                  <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:100%_4px]"></div>
                </div>
              );
            })
          )}
        </div>

        {/* Promotion Selector Hologram Modal */}
        {pendingPromotion && (
          <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-4">
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-1.5 text-cyan-400 mb-1">
                <Sparkles size={16} />
                <h4 className="text-sm font-cyber font-bold tracking-wider uppercase">PAWN PROMOTION</h4>
              </div>
              <p className="text-xs font-mono text-slate-300">Select upgraded tactical avatar</p>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { type: 'q', label: 'Queen', icon: PIECE_UNICODE[orientation === 'w' ? 'Q' : 'q'] },
                { type: 'r', label: 'Rook', icon: PIECE_UNICODE[orientation === 'w' ? 'R' : 'r'] },
                { type: 'b', label: 'Bishop', icon: PIECE_UNICODE[orientation === 'w' ? 'B' : 'b'] },
                { type: 'n', label: 'Knight', icon: PIECE_UNICODE[orientation === 'w' ? 'N' : 'n'] }
              ].map((promo) => (
                <button
                  key={promo.type}
                  onClick={() => handleSelectPromotion(promo.type as any)}
                  className="flex flex-col items-center p-3 bg-slate-900 border border-cyan-500/60 rounded-lg hover:bg-cyan-950 hover:border-cyan-400 transition-all hover:scale-105 group"
                >
                  <span className="text-4xl text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] group-hover:scale-110 transition-transform">
                    {promo.icon}
                  </span>
                  <span className="text-[10px] font-cyber text-slate-300 uppercase mt-1">
                    {promo.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Disabled Overlay message (e.g. spectator or waiting) */}
        {!interactive && disabledReason && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="px-3 py-1.5 bg-black/80 border border-slate-700/80 rounded-full backdrop-blur-md flex items-center gap-2 text-xs font-mono text-slate-300 shadow-lg">
              <ShieldAlert size={14} className="text-amber-400" />
              <span>{disabledReason}</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Captured Material Bar */}
      <div className="w-full flex items-center justify-between px-2 py-1 mt-1 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
            {orientation === 'w' ? 'White Losses:' : 'Black Losses:'}
          </span>
          <div className="flex items-center gap-0.5 text-base leading-none">
            {(orientation === 'w' ? blackCaptured : whiteCaptured).map((p, idx) => (
              <span key={idx} className={p === p.toUpperCase() ? 'text-cyan-400' : 'text-fuchsia-400'}>
                {PIECE_UNICODE[p]}
              </span>
            ))}
          </div>
          {orientation === 'b' && materialDiff > 0 && (
            <span className="text-cyan-400 font-bold ml-1">+{materialDiff}</span>
          )}
          {orientation === 'w' && materialDiff < 0 && (
            <span className="text-fuchsia-400 font-bold ml-1">+{Math.abs(materialDiff)}</span>
          )}
        </div>
      </div>
    </div>
  );
};
