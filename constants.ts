export const BOARD_SIZE = 8;
export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const THEME = {
  colors: {
    primary: '#06b6d4', // Cyan-500
    primaryGlow: '#22d3ee', // Cyan-400
    secondary: '#d946ef', // Fuchsia-500
    secondaryGlow: '#e879f9', // Fuchsia-400
    dark: '#0a0a0a',
    darker: '#050505',
    boardDark: 'rgba(10, 10, 10, 0.8)',
    boardLight: 'rgba(30, 41, 59, 0.5)',
    highlight: 'rgba(34, 211, 238, 0.3)',
    lastMove: 'rgba(217, 70, 239, 0.3)',
  }
};

export const PIECE_UNICODE: Record<string, string> = {
  p: '♟',
  r: '♜',
  n: '♞',
  b: '♝',
  q: '♛',
  k: '♚',
  P: '♙',
  R: '♖',
  N: '♘',
  B: '♗',
  Q: '♕',
  K: '♔'
};
