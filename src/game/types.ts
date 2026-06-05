// ─── Card types ──────────────────────────────────────────────────────────────

export type Suit = 'espadas' | 'bastos' | 'copas' | 'oros';
export type CardNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Card {
  number: CardNumber;
  suit: Suit;
  id: string;
}

// ─── Player types ─────────────────────────────────────────────────────────────

// Positions: 0=bottom(human), 1=left, 2=top, 3=right
// Table goes clockwise: 0 → 3 → 2 → 1 → 0
export type PlayerPosition = 0 | 1 | 2 | 3;

export interface Player {
  id: string;
  name: string;
  avatarId: number;
  isHuman: boolean;
  isOnline: boolean;
  position: PlayerPosition;
  team: 0 | 1; // team A: positions 0,2 — team B: positions 1,3
}

// ─── Canto types ──────────────────────────────────────────────────────────────

export type TrucoCanto = 'truco' | 'retruco' | 'vale_nueve' | 'vale_juego';
export type EnvidoCanto =
  | 'envido'
  | 'envido_envido'    // quiero y envido (sube 2 más)
  | 'falta_envido'
  | 'las_piedras';     // X piedras libremente elegidas

export type FlorCanto = 'flor' | 'flor_reservada'; // flor_reservada = Perico+Perica+otra
export type CantoType = TrucoCanto | EnvidoCanto | FlorCanto | 'prive' | 'barajo' | 'mazo';

export type CantoResponse = 'quiero' | 'no_quiero' | CantoType;

export interface PendingCanto {
  type: CantoType;
  byPlayerId: string;
  byTeam: 0 | 1;
  points: number;           // puntos en juego si se acepta
  previousAccepted: number; // puntos si se rechaza
}

// ─── Baza (trick) ─────────────────────────────────────────────────────────────

export interface PlayedCard {
  playerId: string;
  card: Card;
}

export interface Baza {
  plays: PlayedCard[];
  winnerId: string | null;    // null = emparde
  winnerTeam: 0 | 1 | null;
  isEmparde: boolean;
}

// ─── Game phase ───────────────────────────────────────────────────────────────

export type GamePhase =
  | 'waiting'
  | 'playing'
  | 'canto'
  | 'envido_show'
  | 'hand_end'
  | 'game_over';

export type GameMode = 'local_2p' | 'local_4p' | 'online_2p' | 'online_4p';

// ─── Hand (mano) state ────────────────────────────────────────────────────────

export interface HandState {
  handNumber: number;
  dealerPosition: PlayerPosition;
  firstPlayerPosition: PlayerPosition; // RIGHT of dealer
  manoPlayerId: string;                // who plays first this hand
  vira: Card | null;
  pericopalos: { perico: Card | null; perica: Card | null };
  florReservadaPlayerId: string | null; // player with Perico+Perica+other
  hands: Record<string, Card[]>;
  playedCards: Record<string, Card[]>;
  bazas: Baza[];
  currentBaza: PlayedCard[];
  currentRound: 1 | 2 | 3;    // which round (ronda) we are in
  currentTurnPlayerId: string;
  trucoCanto: PendingCanto | null;
  envidoCanto: PendingCanto | null;
  trucoAccepted: number;
  envidoAccepted: number;
  envidoResolved: boolean;
  trucoResolved: boolean;
  florResolved: boolean;
  mazoPlayerId: string | null;
  // Sistema de voz del truco: equipo que cantó el último nivel aceptado
  // El equipo CONTRARIO puede escalar en su turno
  lastTrucoByTeam: 0 | 1 | null;
  // Emparde tracking
  empardeCard: Card | null;
  empardeRound: 1 | 2 | null;
  // Resultado del envido (para mostrarlo al final de la mano)
  envidoResult: {
    teamScores: [number, number];
    envidoCards: Record<string, Card[]>; // solo las cartas que envidaron (1 o 2)
    winner: 0 | 1;
    points: number;
  } | null;
  // Marca para evitar volver a asignar puntos de envido al final de la mano
  envidoAwarded?: boolean;
  // Modo "Cantando" (Estar Privando)
  cantandoTeam?: 0 | 1 | null;
  cantandoRequired?: boolean; // el equipo debe cantar su envite al iniciar
  cantandoMaxEnvido?: [number, number] | null; // max envido por equipo al inicio
  privoByTeam?: 0 | 1 | null; // equipo que declaró Privo
  priveActive?: boolean; // si el privo fue aceptado y se jugará Truco
  cantandoLostRight?: boolean; // si el equipo cantando jugó carta sin cantar
}

// ─── Full game state ──────────────────────────────────────────────────────────

export interface GameState {
  id: string;
  mode: GameMode;
  maxPoints: 12 | 24;
  players: Player[];
  teamScores: [number, number];
  phase: GamePhase;
  hand: HandState | null;
  winner: 0 | 1 | null;
  roomId: string | null;
  florPorDerecho: boolean; // agreed before game starts
}

// ─── Game actions ─────────────────────────────────────────────────────────────

export type GameActionType =
  | 'PLAY_CARD'
  | 'SING_TRUCO'
  | 'SING_ENVIDO'
  | 'SING_FLOR'
  | 'SING_PRIVE'
  | 'SING_BARAJO'
  | 'RESPOND_CANTO'
  | 'GO_TO_MAZO'
  | 'START_HAND';

export interface GameAction {
  type: GameActionType;
  playerId: string;
  payload?: {
    card?: Card;
    canto?: CantoType;
    response?: CantoResponse;
    piedrasPoints?: number;
    envidoLasQuePintan?: number; // value of played card used as bet
  };
}

// ─── Señas (partner signals in 4p mode) ──────────────────────────────────────

export type Sena =
  | 'flor'           // inflar cachetes
  | 'flor_reservada' // guiñar ojo izquierdo luego derecho
  | 'ven_a_mi'       // carta baja
  | 'quedate'        // carta alta
  | 'llevas';        // ¿tienes buen envido?

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  isQuickReply: boolean;
}

export const QUICK_REPLIES = ['¡Buena!', '¡Truco!', '😂', '👏', '¡Qué mano!', '🤙'] as const;

// ─── Lobby ────────────────────────────────────────────────────────────────────

export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type RoomVisibility = 'public' | 'private';

export interface Room {
  id: string;
  code: string;
  mode: GameMode;
  maxPoints: 12 | 24;
  status: RoomStatus;
  visibility: RoomVisibility;
  createdBy: string;
  players: RoomPlayer[];
}

export interface RoomPlayer {
  userId: string;
  username: string;
  avatarId: number;
  position: PlayerPosition;
  isReady: boolean;
  isConnected: boolean;
}

// ─── User profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  username: string;
  avatarId: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  currentStreak: number;
}

export const AVATAR_COUNT = 12;
