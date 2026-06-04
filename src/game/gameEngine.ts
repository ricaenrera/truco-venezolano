import type {
  GameState, GameAction, HandState, Player, Card,
  PlayerPosition, Baza, PlayedCard, PendingCanto,
  TrucoCanto, EnvidoCanto, CantoResponse, GameMode,
} from './types';
import { buildDeck, deal, resolvePericopalos, isPerico, isPerica } from './deck';
import { determineBazaWinner, TRUCO_NO_QUIERO_POINTS, TRUCO_QUIERO_POINTS } from './trucoRank';
import {
  calculateEnvido, envidoValue, hasFlor, hasFlorReservada, hasFlorConPericopalos,
  florScore, faltaEnvidoPoints, valeJuegoPoints, isPriving,
  ENVIDO_NO_QUIERO_POINTS,
} from './envido';
import type { PericopalosInfo } from './deck';
import { generateId } from '../utils/helpers';

// Devuelve las 1 o 2 cartas que forman el mejor envido (Perico/Perica son comodines)
function getBestEnvidoCards(hand: Card[], peri: PericopalosInfo): Card[] {
  if (hand.length === 0) return [];

  const wildcards = hand.filter((c) => isPerico(c, peri) || isPerica(c, peri));
  const normals   = hand.filter((c) => !isPerico(c, peri) && !isPerica(c, peri));

  let best: Card[] = [];
  let bestScore = -1;

  const tryPair = (a: Card, b: Card) => {
    const score = envidoValue(a, peri) + envidoValue(b, peri) + 20;
    if (score > bestScore) { bestScore = score; best = [a, b]; }
  };

  // 2 wildcards emparejan entre sí
  if (wildcards.length >= 2) tryPair(wildcards[0], wildcards[1]);

  // Wildcard + mejor carta normal
  for (const wc of wildcards) {
    for (const nc of normals) tryPair(wc, nc);
    const sv = envidoValue(wc, peri);
    if (sv > bestScore) { bestScore = sv; best = [wc]; }
  }

  // Pares normales de la misma pinta
  const bySuit: Record<string, Card[]> = {};
  for (const c of normals) {
    if (!bySuit[c.suit]) bySuit[c.suit] = [];
    bySuit[c.suit].push(c);
  }
  for (const suitCards of Object.values(bySuit)) {
    if (suitCards.length >= 2) {
      const sorted = [...suitCards].sort((a, b) => envidoValue(b, peri) - envidoValue(a, peri));
      tryPair(sorted[0], sorted[1]);
    } else {
      const sv = envidoValue(suitCards[0], peri);
      if (sv > bestScore) { bestScore = sv; best = [suitCards[0]]; }
    }
  }

  return best;
}

// ─── Estado inicial ───────────────────────────────────────────────────────────

export function createInitialGameState(
  players: Player[],
  mode: GameMode,
  maxPoints: 12 | 24,
  roomId: string | null = null,
  florPorDerecho = false
): GameState {
  return {
    id: generateId(),
    mode,
    maxPoints,
    players,
    teamScores: [0, 0],
    phase: 'waiting',
    hand: null,
    winner: null,
    roomId,
    florPorDerecho,
  };
}

// ─── Iniciar mano ─────────────────────────────────────────────────────────────

export function startHand(state: GameState): GameState {
  const playerCount = state.players.length as 2 | 4;
  const deck = buildDeck();
  const { hands, vira } = deal(deck, playerCount);
  const pericopalos = resolvePericopalos(vira);

  const handMap: Record<string, Card[]> = {};
  state.players.forEach((p, i) => { handMap[p.id] = hands[i]; });

  const handNumber = (state.hand?.handNumber ?? 0) + 1;

  // El repartidor rota. El primero en jugar está a la DERECHA del repartidor.
  const prevDealer = state.hand?.dealerPosition ?? -1;
  const dealerPos = ((prevDealer + 1) % playerCount) as PlayerPosition;
  // Derecha del repartidor: posición anterior en el orden de turnos
  const firstPos = ((dealerPos - 1 + playerCount) % playerCount) as PlayerPosition;
  const firstPlayer = state.players.find((p) => p.position === firstPos)
    ?? state.players[0];

  // Detectar flor reservada (Perico + Perica + otra)
  const peri = { perico: pericopalos.perico, perica: pericopalos.perica };
  let florReservadaPlayerId: string | null = null;
  for (const p of state.players) {
    if (hasFlorReservada(handMap[p.id], peri)) {
      florReservadaPlayerId = p.id;
      break;
    }
  }

  const hand: HandState = {
    handNumber,
    dealerPosition: dealerPos,
    firstPlayerPosition: firstPos,
    manoPlayerId: firstPlayer.id,
    vira,
    pericopalos: { perico: peri.perico, perica: peri.perica },
    florReservadaPlayerId,
    hands: handMap,
    playedCards: Object.fromEntries(state.players.map((p) => [p.id, []])),
    bazas: [],
    currentBaza: [],
    currentRound: 1,
    currentTurnPlayerId: firstPlayer.id,
    trucoCanto: null,
    envidoCanto: null,
    trucoAccepted: 0,
    envidoAccepted: 0,
    envidoResolved: false,
    trucoResolved: false,
    florResolved: false,
    mazoPlayerId: null,
    lastTrucoByTeam: null,
    empardeCard: null,
    empardeRound: null,
    envidoResult: null,
  };

  // Flor reservada suma 5 puntos automáticos al inicio
  let newScores = state.teamScores;
  if (florReservadaPlayerId) {
    const player = state.players.find((p) => p.id === florReservadaPlayerId)!;
    newScores = [...state.teamScores] as [number, number];
    newScores[player.team] += 5;
  }

  return { ...state, teamScores: newScores, phase: 'playing', hand };
}

// ─── Reducer principal ────────────────────────────────────────────────────────

export function applyAction(state: GameState, action: GameAction): GameState {
  if (!state.hand && action.type !== 'START_HAND') return state;

  switch (action.type) {
    case 'START_HAND':     return startHand(state);
    case 'PLAY_CARD':      return handlePlayCard(state, action);
    case 'SING_TRUCO':     return handleSingTruco(state, action);
    case 'SING_ENVIDO':    return handleSingEnvido(state, action);
    case 'SING_FLOR':      return handleSingFlor(state, action);
    case 'SING_PRIVE':     return handleSingPrive(state, action);
    case 'SING_BARAJO':    return handleSingBarajo(state, action);
    case 'RESPOND_CANTO':  return handleRespondCanto(state, action);
    case 'GO_TO_MAZO':     return handleGoToMazo(state, action);
    default:               return state;
  }
}

// ─── Jugar carta ──────────────────────────────────────────────────────────────

function handlePlayCard(state: GameState, action: GameAction): GameState {
  const hand = state.hand!;
  const card = action.payload?.card;
  if (!card || hand.currentTurnPlayerId !== action.playerId) return state;

  const playerHand = hand.hands[action.playerId];
  const cardIdx = playerHand.findIndex((c) => c.id === card.id);
  if (cardIdx === -1) return state;

  const newHands = {
    ...hand.hands,
    [action.playerId]: playerHand.filter((_, i) => i !== cardIdx),
  };
  const newPlayed = {
    ...hand.playedCards,
    [action.playerId]: [...(hand.playedCards[action.playerId] ?? []), card],
  };
  const newBaza: PlayedCard[] = [...hand.currentBaza, { playerId: action.playerId, card }];

  const playerCount = state.players.length;
  let newState: GameState = {
    ...state,
    hand: { ...hand, hands: newHands, playedCards: newPlayed, currentBaza: newBaza },
  };

  if (newBaza.length === playerCount) {
    newState = resolveBaza(newState, newBaza);
  } else {
    newState = advanceTurn(newState, action.playerId);
  }

  return checkHandEnd(newState);
}

function resolveBaza(state: GameState, baza: PlayedCard[]): GameState {
  const hand = state.hand!;
  const pericopalos = hand.pericopalos.perico && hand.pericopalos.perica
    ? { perico: hand.pericopalos.perico, perica: hand.pericopalos.perica }
    : undefined;
  const { winnerId, isEmparde } = determineBazaWinner(baza, pericopalos);
  const winnerTeam = winnerId
    ? (state.players.find((p) => p.id === winnerId)?.team ?? null)
    : null;

  const resolvedBaza: Baza = { plays: baza, winnerId, winnerTeam, isEmparde };
  const newBazas = [...hand.bazas, resolvedBaza];
  const currentRound = hand.currentRound;

  let empardeCard = hand.empardeCard;
  let empardeRound = hand.empardeRound;
  let nextTurnId: string;
  let nextRound = currentRound as 1 | 2 | 3;

  if (isEmparde) {
    // Emparde: la carta del medio queda oculta, se salta a la siguiente ronda
    // En 2j: se toma la carta "del medio" (la del pie que fue empate)
    empardeCard = baza[baza.length - 1].card;
    empardeRound = currentRound as 1 | 2;

    if (currentRound === 1) {
      // Saltar ronda 2 directamente a ronda 3
      nextRound = 3;
    } else {
      nextRound = 3;
    }
    // Quien sigue en mano (el primero en la ronda original)
    nextTurnId = hand.manoPlayerId;
  } else {
    // El ganador de esta baza empieza la siguiente
    nextTurnId = winnerId ?? hand.manoPlayerId;
    nextRound = (currentRound < 3 ? currentRound + 1 : 3) as 1 | 2 | 3;
  }

  return {
    ...state,
    hand: {
      ...hand,
      bazas: newBazas,
      currentBaza: [],
      currentRound: nextRound,
      currentTurnPlayerId: nextTurnId,
      empardeCard,
      empardeRound,
    },
  };
}

function advanceTurn(state: GameState, currentPlayerId: string): GameState {
  const next = getNextPlayer(state, currentPlayerId);
  return { ...state, hand: { ...state.hand!, currentTurnPlayerId: next.id } };
}

function getNextPlayer(state: GameState, currentPlayerId: string): Player {
  const idx = state.players.findIndex((p) => p.id === currentPlayerId);
  return state.players[(idx + 1) % state.players.length];
}

// ─── Truco ────────────────────────────────────────────────────────────────────

function handleSingTruco(state: GameState, action: GameAction): GameState {
  const hand = state.hand!;
  const canto = action.payload?.canto as TrucoCanto;
  const player = state.players.find((p) => p.id === action.playerId)!;

  const previousAccepted = hand.trucoCanto?.previousAccepted
    ?? (hand.trucoAccepted > 0 ? hand.trucoAccepted : 0);

  const quieroPoints = canto === 'vale_juego'
    ? valeJuegoPoints(state.teamScores, state.maxPoints)
    : (TRUCO_QUIERO_POINTS[canto] ?? 3);

  const pending: PendingCanto = {
    type: canto,
    byPlayerId: action.playerId,
    byTeam: player.team,
    points: quieroPoints,
    previousAccepted,
  };

  return { ...state, phase: 'canto', hand: { ...hand, trucoCanto: pending } };
}

// ─── Envido ───────────────────────────────────────────────────────────────────

function handleSingEnvido(state: GameState, action: GameAction): GameState {
  const hand = state.hand!;
  // Envido solo en la primera ronda
  if (hand.currentRound !== 1 || hand.envidoResolved) return state;

  const canto = action.payload?.canto as EnvidoCanto;
  const player = state.players.find((p) => p.id === action.playerId)!;

  let points: number;
  if (canto === 'falta_envido') {
    points = faltaEnvidoPoints(state.teamScores, state.maxPoints);
  } else if (canto === 'las_piedras') {
    points = action.payload?.piedrasPoints ?? 3;
  } else if (canto === 'envido_envido') {
    points = (hand.envidoCanto?.points ?? 2) + 2;
  } else {
    points = canto === 'envido' ? 2 : 3;
  }

  const previousAccepted = hand.envidoCanto?.points ?? 0;

  const pending: PendingCanto = {
    type: canto,
    byPlayerId: action.playerId,
    byTeam: player.team,
    points,
    previousAccepted,
  };

  return { ...state, phase: 'canto', hand: { ...hand, envidoCanto: pending } };
}

// ─── Flor ─────────────────────────────────────────────────────────────────────

function handleSingFlor(state: GameState, action: GameAction): GameState {
  const hand = state.hand!;
  if (hand.currentRound !== 1 || hand.florResolved) return state;

  const player = state.players.find((p) => p.id === action.playerId)!;
  const pericopalos = { perico: hand.pericopalos.perico!, perica: hand.pericopalos.perica! };

  // ¿El rival también tiene flor?
  const opponents = state.players.filter((p) => p.team !== player.team);
  const opponentHasFlor = opponents.some(
    (p) => hasFlor(hand.hands[p.id] ?? [], pericopalos)
  );

  if (!opponentHasFlor) {
    // Solo yo tengo flor → 3 puntos automáticos
    const newScores: [number, number] = [...state.teamScores] as [number, number];
    newScores[player.team] += 3;
    return {
      ...state,
      teamScores: newScores,
      hand: { ...hand, envidoResolved: true, florResolved: true },
      phase: checkGameOver({ ...state, teamScores: newScores }) ? 'game_over' : 'playing',
      winner: newScores[0] >= state.maxPoints ? 0 : newScores[1] >= state.maxPoints ? 1 : null,
    };
  }

  // Ambos tienen flor → se envidan las flores
  const myFlorScore = florScore(hand.hands[action.playerId], pericopalos);
  const pending: PendingCanto = {
    type: 'flor',
    byPlayerId: action.playerId,
    byTeam: player.team,
    points: myFlorScore,
    previousAccepted: 0,
  };

  return { ...state, phase: 'canto', hand: { ...hand, envidoCanto: pending } };
}

// ─── Prive ────────────────────────────────────────────────────────────────────

function handleSingPrive(state: GameState, action: GameAction): GameState {
  const hand = state.hand!;
  const player = state.players.find((p) => p.id === action.playerId)!;

  if (!isPriving(state.teamScores, state.maxPoints, player.team)) return state;

  const pericopalos = { perico: hand.pericopalos.perico!, perica: hand.pericopalos.perica! };
  const myPrive = calculateEnvido(hand.hands[action.playerId] ?? [], pericopalos);

  const pending: PendingCanto = {
    type: 'prive',
    byPlayerId: action.playerId,
    byTeam: player.team,
    points: 1, // el prive vale el 1 punto que le falta
    previousAccepted: myPrive, // el puntaje de prive
  };

  return { ...state, phase: 'canto', hand: { ...hand, envidoCanto: pending } };
}

// ─── Barajo ───────────────────────────────────────────────────────────────────

function handleSingBarajo(state: GameState, action: GameAction): GameState {
  const player = state.players.find((p) => p.id === action.playerId)!;
  const newScores: [number, number] = [...state.teamScores] as [number, number];
  newScores[player.team] += 2;

  if (newScores[0] >= state.maxPoints) return { ...state, teamScores: newScores, phase: 'game_over', winner: 0 };
  if (newScores[1] >= state.maxPoints) return { ...state, teamScores: newScores, phase: 'game_over', winner: 1 };

  return { ...state, teamScores: newScores };
}

// ─── Responder canto ──────────────────────────────────────────────────────────

function handleRespondCanto(state: GameState, action: GameAction): GameState {
  const hand = state.hand!;
  const response = action.payload?.response as CantoResponse;
  const player = state.players.find((p) => p.id === action.playerId)!;

  const isTrucoPending = !!hand.trucoCanto && hand.trucoCanto.byTeam !== player.team;
  const isEnvidoPending = !!hand.envidoCanto && hand.envidoCanto.byTeam !== player.team;

  if (isTrucoPending) return respondTruco(state, response, player);
  if (isEnvidoPending) return respondEnvido(state, response, player, action.payload?.piedrasPoints);
  return state;
}

function respondTruco(state: GameState, response: CantoResponse, player: Player): GameState {
  const hand = state.hand!;
  const canto = hand.trucoCanto!;

  if (response === 'no_quiero') {
    const points = TRUCO_NO_QUIERO_POINTS[canto.type] ?? 1;
    const newScores: [number, number] = [...state.teamScores] as [number, number];
    newScores[canto.byTeam] += points;

    // Regla: si no se quiere el truco, la mano termina SIEMPRE sin importar la ronda
    if (newScores[0] >= state.maxPoints) return { ...state, teamScores: newScores, phase: 'game_over', winner: 0 };
    if (newScores[1] >= state.maxPoints) return { ...state, teamScores: newScores, phase: 'game_over', winner: 1 };

    return {
      ...state,
      teamScores: newScores,
      phase: 'hand_end',
      hand: { ...hand, trucoCanto: null, trucoResolved: true, trucoAccepted: 0 },
    };
  }

  if (response === 'quiero') {
    // El equipo que CANTÓ el truco queda como lastTrucoByTeam.
    // El equipo CONTRARIO (el que aceptó) podrá escalar en su turno.
    return {
      ...state,
      phase: 'playing',
      hand: { ...hand, trucoAccepted: canto.points, trucoCanto: null, lastTrucoByTeam: canto.byTeam },
    };
  }

  // Escalación: retruco, vale_nueve, vale_juego
  const escalation = response as TrucoCanto;
  const quieroPoints = escalation === 'vale_juego'
    ? valeJuegoPoints(state.teamScores, state.maxPoints)
    : (TRUCO_QUIERO_POINTS[escalation] ?? canto.points);

  const newPending: PendingCanto = {
    type: escalation,
    byPlayerId: player.id,
    byTeam: player.team,
    points: quieroPoints,
    previousAccepted: canto.points,
  };

  return { ...state, phase: 'canto', hand: { ...hand, trucoCanto: newPending } };
}

function respondEnvido(state: GameState, response: CantoResponse, player: Player, piedrasPoints?: number): GameState {
  const hand = state.hand!;
  const canto = hand.envidoCanto!;
  const pericopalos = { perico: hand.pericopalos.perico!, perica: hand.pericopalos.perica! };

  // ── Responder con FLOR cancela el envido ─────────────────────────────────
  // El que tiene flor gana automáticamente 3 puntos; el envido del oponente queda anulado.
  if (response === 'flor') {
    const opponents = state.players.filter((p) => p.team !== player.team);
    const opponentHasFlor = opponents.some((p) => hasFlor(hand.hands[p.id] ?? [], pericopalos));

    if (!opponentHasFlor) {
      // Solo yo tengo flor → 3 puntos, envido cancelado
      const newScores: [number, number] = [...state.teamScores] as [number, number];
      newScores[player.team] += 3;
      return checkHandEnd({
        ...state,
        phase: 'playing',
        teamScores: newScores,
        hand: { ...hand, envidoCanto: null, envidoResolved: true, florResolved: true },
      });
    }

    // Ambos tienen flor → comparar flores (igual que handleSingFlor)
    const myFlorScore = florScore(hand.hands[player.id] ?? [], pericopalos);
    const pending: PendingCanto = {
      type: 'flor',
      byPlayerId: player.id,
      byTeam: player.team,
      points: myFlorScore,
      previousAccepted: 0,
    };
    return { ...state, phase: 'canto', hand: { ...hand, envidoCanto: pending } };
  }

  if (response === 'no_quiero') {
    const points = ENVIDO_NO_QUIERO_POINTS[canto.type] ?? 1;
    const newScores: [number, number] = [...state.teamScores] as [number, number];
    newScores[canto.byTeam] += points;

    return checkHandEnd({
      ...state,
      phase: 'playing',
      teamScores: newScores,
      hand: { ...hand, envidoCanto: null, envidoResolved: true, florResolved: true },
    });
  }

  if (response === 'quiero') {
    if (canto.type === 'prive') {
      const myScore = calculateEnvido(hand.hands[player.id] ?? [], pericopalos);
      const theirScore = canto.previousAccepted;
      const winner: 0 | 1 = myScore >= theirScore ? player.team : canto.byTeam;
      const newScores: [number, number] = [...state.teamScores] as [number, number];
      newScores[winner] += 1;
      return checkHandEnd({
        ...state,
        phase: 'playing',
        teamScores: newScores,
        hand: { ...hand, envidoCanto: null, envidoResolved: true },
      });
    }

    if (canto.type === 'flor') {
      const team0Players = state.players.filter((p) => p.team === 0);
      const team1Players = state.players.filter((p) => p.team === 1);
      const score0 = Math.max(...team0Players.map((p) => florScore(hand.hands[p.id] ?? [], pericopalos)));
      const score1 = Math.max(...team1Players.map((p) => florScore(hand.hands[p.id] ?? [], pericopalos)));
      const winner: 0 | 1 = score0 >= score1 ? 0 : 1;
      const newScores: [number, number] = [...state.teamScores] as [number, number];
      newScores[winner] += canto.points;
      return checkHandEnd({
        ...state,
        phase: 'playing',
        teamScores: newScores,
        hand: { ...hand, envidoCanto: null, envidoResolved: true, florResolved: true },
      });
    }

    // Envido normal: comparar puntajes
    const team0Players = state.players.filter((p) => p.team === 0);
    const team1Players = state.players.filter((p) => p.team === 1);
    const score0 = Math.max(...team0Players.map((p) => calculateEnvido(hand.hands[p.id] ?? [], pericopalos)));
    const score1 = Math.max(...team1Players.map((p) => calculateEnvido(hand.hands[p.id] ?? [], pericopalos)));
    const winner: 0 | 1 = score0 >= score1 ? 0 : 1;
    const newScores: [number, number] = [...state.teamScores] as [number, number];
    newScores[winner] += canto.points;

    // Guardar solo las cartas que aportan al envido de cada jugador
    const envidoCards: Record<string, Card[]> = {};
    for (const p of state.players) {
      envidoCards[p.id] = getBestEnvidoCards(hand.hands[p.id] ?? [], pericopalos);
    }
    const envidoResult = {
      teamScores: [score0, score1] as [number, number],
      envidoCards,
      winner,
      points: canto.points,
    };

    return checkHandEnd({
      ...state,
      phase: 'playing',
      teamScores: newScores,
      hand: { ...hand, envidoCanto: null, envidoResolved: true, envidoAccepted: canto.points, envidoResult },
    });
  }

  // Escalación del envido
  const escalation = response as EnvidoCanto;
  let points: number;
  if (escalation === 'falta_envido') {
    points = faltaEnvidoPoints(state.teamScores, state.maxPoints);
  } else if (escalation === 'las_piedras') {
    points = piedrasPoints ?? canto.points + 3;
  } else if (escalation === 'envido_envido') {
    points = canto.points + 2;
  } else {
    points = canto.points + 3;
  }

  const newPending: PendingCanto = {
    type: escalation,
    byPlayerId: player.id,
    byTeam: player.team,
    points,
    previousAccepted: canto.points,
  };

  return { ...state, phase: 'canto', hand: { ...hand, envidoCanto: newPending } };
}

// ─── Mazo ─────────────────────────────────────────────────────────────────────

function handleGoToMazo(state: GameState, action: GameAction): GameState {
  const hand = state.hand!;
  const player = state.players.find((p) => p.id === action.playerId)!;
  const opponentTeam: 0 | 1 = player.team === 0 ? 1 : 0;

  // El rival gana los puntos en juego (truco aceptado o 1 mínimo)
  const trucoPoints = hand.trucoAccepted > 0
    ? hand.trucoAccepted
    : (hand.trucoCanto ? TRUCO_NO_QUIERO_POINTS[hand.trucoCanto.type] ?? 1 : 1);

  const newScores: [number, number] = [...state.teamScores] as [number, number];
  newScores[opponentTeam] += trucoPoints;

  return checkHandEnd({
    ...state,
    phase: 'playing',
    teamScores: newScores,
    hand: { ...hand, mazoPlayerId: action.playerId, trucoResolved: true },
  });
}

// ─── Fin de mano ──────────────────────────────────────────────────────────────

function checkGameOver(state: GameState): boolean {
  return state.teamScores[0] >= state.maxPoints || state.teamScores[1] >= state.maxPoints;
}

function checkHandEnd(state: GameState): GameState {
  if (state.teamScores[0] >= state.maxPoints) return { ...state, phase: 'game_over', winner: 0 };
  if (state.teamScores[1] >= state.maxPoints) return { ...state, phase: 'game_over', winner: 1 };

  const hand = state.hand;
  if (!hand) return state;
  if (hand.mazoPlayerId) return { ...state, phase: 'hand_end' };

  const team0Bazas = hand.bazas.filter((b) => b.winnerTeam === 0).length;
  const team1Bazas = hand.bazas.filter((b) => b.winnerTeam === 1).length;
  const totalBazas = hand.bazas.length;

  let handWinner: 0 | 1 | null = null;

  if (team0Bazas >= 2) handWinner = 0;
  else if (team1Bazas >= 2) handWinner = 1;
  else if (totalBazas === 3) {
    if (team0Bazas > team1Bazas) handWinner = 0;
    else if (team1Bazas > team0Bazas) handWinner = 1;
    else {
      // Triple empate: gana el jugador que es mano
      const manoPlayer = state.players.find((p) => p.id === hand.manoPlayerId);
      handWinner = manoPlayer?.team ?? 0;
    }
  }

  if (handWinner !== null) {
    // Si nadie cantó truco → 1 punto. Si se cantó → los puntos aceptados.
    const trucoPoints = hand.trucoAccepted > 0 ? hand.trucoAccepted : 1;
    const newScores: [number, number] = [...state.teamScores] as [number, number];
    newScores[handWinner] += trucoPoints;

    if (newScores[0] >= state.maxPoints) return { ...state, teamScores: newScores, phase: 'game_over', winner: 0 };
    if (newScores[1] >= state.maxPoints) return { ...state, teamScores: newScores, phase: 'game_over', winner: 1 };

    return { ...state, teamScores: newScores, phase: 'hand_end' };
  }

  return state;
}

// ─── Helpers públicos ─────────────────────────────────────────────────────────

export function canSingTruco(state: GameState, playerId: string): TrucoCanto | null {
  const hand = state.hand;
  if (!hand || hand.trucoResolved) return null;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  // ── Hay un canto de truco pendiente de respuesta ──────────────────────────
  const pending = hand.trucoCanto;
  if (pending) {
    if (pending.byTeam === player.team) return null;
    const escalation: Record<string, TrucoCanto | null> = {
      truco: 'retruco', retruco: 'vale_nueve', vale_nueve: 'vale_juego', vale_juego: null,
    };
    return escalation[pending.type] ?? null;
  }

  // ── Sistema de VOZ: el equipo que ACEPTÓ puede escalar en su turno ────────
  // lastTrucoByTeam = equipo que cantó el último nivel aceptado.
  // El equipo CONTRARIO tiene "la voz" y puede escalar cuando sea su turno.
  if (hand.trucoAccepted > 0) {
    if (hand.lastTrucoByTeam === null) return null;
    // Solo el equipo contrario al que cantó tiene la voz
    if (hand.lastTrucoByTeam === player.team) return null;
    // Solo puede escalar en su turno de carta
    if (hand.currentTurnPlayerId !== playerId) return null;
    const next: Record<number, TrucoCanto | null> = {
      3: 'retruco', 6: 'vale_nueve', 9: 'vale_juego',
    };
    return next[hand.trucoAccepted] ?? null;
  }

  // ── Sin truco activo: cualquiera puede cantar en su turno ─────────────────
  if (hand.currentTurnPlayerId !== playerId) return null;
  return 'truco';
}

// Envido solo se puede cantar en la primera ronda
export function canSingEnvido(state: GameState, _playerId: string): boolean {
  const hand = state.hand;
  if (!hand || hand.envidoResolved || hand.envidoCanto) return false;
  if (hand.currentRound !== 1) return false;
  return true;
}

export function canSingFlor(state: GameState, playerId: string): boolean {
  const hand = state.hand;
  if (!hand || hand.florResolved || hand.currentRound !== 1) return false;
  const pericopalos = { perico: hand.pericopalos.perico!, perica: hand.pericopalos.perica! };
  const myCards = hand.hands[playerId] ?? [];
  return hasFlor(myCards, pericopalos) && !hasFlorReservada(myCards, pericopalos);
}

export function canSingPrive(state: GameState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  return isPriving(state.teamScores, state.maxPoints, player.team)
    && !state.hand?.envidoResolved;
}
