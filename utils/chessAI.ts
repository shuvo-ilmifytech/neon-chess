import { Chess, Square, Move } from 'chess.js';
import { AIDifficulty } from '../types';

// Piece value heuristics
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

// Piece-Square positional bonus tables
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
];

function evaluateBoard(game: Chess): number {
  let totalScore = 0;
  const board = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const baseVal = PIECE_VALUES[piece.type] || 0;
      const index = r * 8 + c;
      const flippedIndex = (7 - r) * 8 + c;

      let posBonus = 0;
      if (piece.type === 'p') {
        posBonus = piece.color === 'w' ? PAWN_TABLE[flippedIndex] : PAWN_TABLE[index];
      } else if (piece.type === 'n') {
        posBonus = piece.color === 'w' ? KNIGHT_TABLE[flippedIndex] : KNIGHT_TABLE[index];
      } else if (piece.type === 'b') {
        posBonus = piece.color === 'w' ? BISHOP_TABLE[flippedIndex] : BISHOP_TABLE[index];
      }

      const score = baseVal + posBonus;
      totalScore += piece.color === 'w' ? score : -score;
    }
  }

  return totalScore;
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard(game);
  }

  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return evaluateBoard(game);

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(game, depth - 1, alpha, beta, false);
      game.undo();
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const evaluation = minimax(game, depth - 1, alpha, beta, true);
      game.undo();
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

export function getBestMove(
  game: Chess,
  difficulty: AIDifficulty
): { from: Square; to: Square; promotion?: string } | null {
  const moves = game.moves({ verbose: true }) as Move[];
  if (moves.length === 0) return null;

  if (difficulty === 'novice') {
    // 60% random, 40% simple capture
    const captureMoves = moves.filter(m => m.captured);
    if (captureMoves.length > 0 && Math.random() < 0.4) {
      const chosen = captureMoves[Math.floor(Math.random() * captureMoves.length)];
      return { from: chosen.from, to: chosen.to, promotion: 'q' };
    }
    const chosen = moves[Math.floor(Math.random() * moves.length)];
    return { from: chosen.from, to: chosen.to, promotion: 'q' };
  }

  const aiColor = game.turn();
  const isMaximizing = aiColor === 'w';
  const depth = difficulty === 'tactical' ? 2 : 3;

  let bestMove: Move = moves[0];
  let bestScore = isMaximizing ? -Infinity : Infinity;

  // Shuffle moves slightly to avoid deterministic repetition
  const shuffledMoves = [...moves].sort(() => Math.random() - 0.5);

  for (const move of shuffledMoves) {
    game.move(move);
    const score = minimax(game, depth - 1, -Infinity, Infinity, !isMaximizing);
    game.undo();

    if (isMaximizing) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
  }

  return { from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion || 'q' };
}
