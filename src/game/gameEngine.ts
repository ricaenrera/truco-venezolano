import type {
  GameState, GameAction, HandState, Player, Card,
  PlayerPosition, Baza, PlayedCard, PendingCanto,
  TrucoCanto, EnvidoCanto, CantoResponse, GameMode,
} from './types';
import { buildDeck, deal, resolvePericopalos, isPerico, isPerica } from './deck';
import { determineBazaWinner } from './trucoRank';
import { TRUCO_NO_QUIERO_POINTS, TRUCO_QUIERO_POINTS } from './rules';
import {
  calculateEnvido, envidoValue, hasFlor, hasFlorReservada,
  florScore, faltaEnvidoPoints, valeJuegoPoints, isPriving,
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
    envidoAwarded: false,
    cantandoTeam: null,
    cantandoRequired: false,
    cantandoMaxEnvido: null,
    privoByTeam: null,
    priveActive: false,
    cantandoLostRight: false,
  };

  // Flor reservada suma 5 puntos automáticos al inicio
  let newScores = state.teamScores;
  if (florReservadaPlayerId) {
    const player = state.players.find((p) => p.id === florReservadaPlayerId)!;
    newScores = [...state.teamScores] as [number, number];
    newScores[player.team] += 5;
  }

  // Detectar modo "Cantando" (Estar Privando)
  // Aplica para partidas en 4 jugadores (o 2 jugadores también si aplica)
  const teamMaxEnvido: [number, number] = [0, 0];
  for (const p of state.players) {
    const v = calculateEnvido(handMap[p.id], peri);
    teamMaxEnvido[p.team] = Math.max(teamMaxEnvido[p.team], v);
  }
  const cantarTeam = state.teamScores[0] === state.maxPoints - 1 ? 0
    : state.teamScores[1] === state.maxPoints - 1 ? 1
    : null;
  if (cantarTeam !== null) {
    hand.cantandoTeam = cantarTeam;
    hand.cantandoRequired = true;
    hand.cantandoMaxEnvido = teamMaxEnvido;
    hand.privoByTeam = null;
    hand.priveActive = false;
    hand.cantandoLostRight = false;
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

  // Si el equipo está "cantando" y aún no cantó su envido, jugar una carta
  // les hace perder el derecho a cobrar automáticamente.
  const player = state.players.find((p) => p.id === action.playerId)!;
  if (hand.cantandoRequired && hand.cantandoTeam === player.team && !hand.priveActive && !hand.envidoCanto) {
    hand.cantandoRequired = false;
    hand.cantandoLostRight = true;
  }

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
    empardeCard = baza[baza.length - 1].card;
    empardeRound = currentRound as 1 | 2;

    // 2 jugadores: mesa nula → seguir con la siguiente mesa normalmente
    // 4 jugadores con emparde en 1ª mesa: saltar a la 3ª (cartas ocultas)
    if (state.players.length === 4 && currentRound === 1) {
      nextRound = 3;
    } else {
      nextRound = (currentRound < 3 ? currentRound + 1 : 3) as 1 | 2 | 3;
    }
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
    // puntos = puntos previos del envido (si existían) + piedras elegidas
    const prev = hand.envidoCanto?.points ?? 2;
    const chosen = action.payload?.piedrasPoints ?? 3;
    points = prev + chosen;
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
    previousAccepted: myPrive, // el puntaje de prive (guardado para referencia)
  };

  return { ...state, phase: 'canto', hand: { ...hand, envidoCanto: pending, privoByTeam: player.team } };
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
    // Rechazar el canto
    if (canto.type === 'prive') {
      // Si se rechazó un Privo, el que cantó Privo recibe 2 puntos (1 envido + 1 truco no querido)
      const newScores: [number, number] = [...state.teamScores] as [number, number];
      newScores[canto.byTeam] += 2;
      return checkHandEnd({
        ...state,
        phase: 'playing',
        teamScores: newScores,
        hand: { ...hand, envidoCanto: null, envidoResolved: true, florResolved: true },
      });
    }

    let points: number;
    let receivingTeam: 0 | 1;

    if (canto.previousAccepted > 0) {
      // Rechazar una escalación (quiero y envido / falta / piedras):
      // el que rechazó se lleva los puntos ya aceptados antes de la escalación
      points = canto.previousAccepted;
      receivingTeam = player.team;
    } else {
      // Rechazar el envido original: el cantante se lleva 1 punto
      points = 1;
      receivingTeam = canto.byTeam;
    }

    const newScores: [number, number] = [...state.teamScores] as [number, number];
    newScores[receivingTeam] += points;

    return checkHandEnd({
      ...state,
      phase: 'playing',
      teamScores: newScores,
      hand: { ...hand, envidoCanto: null, envidoResolved: true, florResolved: true },
    });
  }

  if (response === 'quiero') {
    if (canto.type === 'prive') {
      // El Privo aceptado: no asignar puntos ahora; marcar que se jugará el Truco
      const newHand = { ...hand, envidoCanto: null, envidoResolved: true, priveActive: true, privoByTeam: canto.byTeam, envidoAccepted: 1 };
      return { ...state, phase: 'playing', hand: newHand };
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
    // Si el canto es 'las_piedras', aplazar la asignación de puntos hasta el final de la mano
    if (canto.type === 'las_piedras') {
      // Guardar resultado del envido para asignarlo al final de la mano
      const envidoCards: Record<string, Card[]> = {};
      for (const p of state.players) envidoCards[p.id] = getBestEnvidoCards(hand.hands[p.id] ?? [], pericopalos);
      const envidoResult = {
        teamScores: [score0, score1] as [number, number],
        envidoCards,
        winner,
        points: canto.points,
      };

      return {
        ...checkHandEnd({
          ...state,
          phase: 'playing',
          teamScores: newScores,
          hand: { ...hand, envidoCanto: null, envidoResolved: true, envidoAccepted: canto.points, envidoResult },
        }),
        // ensure we keep the envidoResult in hand
      };
    }

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
    // Escalación a 'las_piedras': puntos = puntos actuales del envido + piedras elegidas
    points = canto.points + (piedrasPoints ?? 3);
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
  const empardes   = hand.bazas.filter((b) => b.isEmparde).length;
  const totalBazas = hand.bazas.length;

  // "Primera manda": quien ganó la primera mesa DECISIVA (no nula) tiene ventaja
  // en cualquier emparde posterior.
  const firstWin = hand.bazas.find((b) => b.winnerTeam !== null);
  const firstWinner: 0 | 1 | null = firstWin?.winnerTeam ?? null;

  // Máximo de bazas posibles según el modo de juego
  // 4j con emparde en 1ª → salta a 3ª → máx 2 bazas
  const is4pSkip = state.players.length === 4 && hand.empardeRound === 1;
  const maxBazas = is4pSkip ? 2 : 3;

  let handWinner: 0 | 1 | null = null;

  if (team0Bazas >= 2) {
    // Gana con 2 mesas directas
    handWinner = 0;
  } else if (team1Bazas >= 2) {
    handWinner = 1;
  } else if (empardes >= 1 && firstWinner !== null) {
    // REGLA "PRIMERA MANDA": hay al menos un emparde y existe un ganador de la
    // primera mesa decisiva → ese equipo gana la mano en cualquier situación de parda.
    // Cubre: 1-0+parda, 0-1+parda, 1-1+parda (3ª parda).
    handWinner = firstWinner;
  } else if (empardes >= 1 && firstWinner === null && totalBazas >= maxBazas) {
    // Todas las mesas quedaron pardas (triple emparde o doble en 4j con salto):
    // gana el equipo que sea MANO.
    const manoPlayer = state.players.find((p) => p.id === hand.manoPlayerId);
    handWinner = manoPlayer?.team ?? 0;
  } else if (empardes === 0 && totalBazas >= maxBazas) {
    // Todas las bazas jugadas sin ningún emparde (caso estándar)
    if (team0Bazas > team1Bazas) handWinner = 0;
    else if (team1Bazas > team0Bazas) handWinner = 1;
    else {
      const manoPlayer = state.players.find((p) => p.id === hand.manoPlayerId);
      handWinner = manoPlayer?.team ?? 0;
    }
  }

  if (handWinner !== null) {
    const trucoPoints = hand.trucoAccepted > 0 ? hand.trucoAccepted : 1;
    const newScores: [number, number] = [...state.teamScores] as [number, number];
    newScores[handWinner] += trucoPoints;

    // Si hubo un Prive aceptado y se jugó el truco, el ganador obtiene +1 por Envido
    if (hand.priveActive) {
      newScores[handWinner] += 1;
    }

    // Verificación obligatoria si estaba en modo 'Cantando' y hubo Privo
    if (hand.cantandoTeam !== undefined && hand.cantandoTeam !== null && hand.privoByTeam !== null) {
      const cantarTeam = hand.cantandoTeam;
      const privoTeam = hand.privoByTeam;
      const opponentWonTruco = handWinner === privoTeam;

      // Solo verificar si el equipo que fue cantado perdió el Truco (el contrario ganó)
      // y la mano no terminó por mazo y no perdieron su derecho por jugar carta
      if (opponentWonTruco && !hand.mazoPlayerId && !hand.cantandoLostRight) {
        const maxima = hand.cantandoMaxEnvido ?? [0, 0];
        const privoMax = maxima[privoTeam];
        const cantarMax = maxima[cantarTeam];

        // Si el equipo privo NO tenía envite mayor, el equipo cantando gana la partida
        if (privoMax <= cantarMax) {
          const newScores2: [number, number] = [...state.teamScores] as [number, number];
          newScores2[cantarTeam] = state.maxPoints;
          return { ...state, teamScores: newScores2, phase: 'game_over', winner: cantarTeam };
        }
      }
    }

    // Si existe un resultado de envido pendiente (p. ej. las_piedras), asignarlo ahora
    if (hand.envidoResult && !hand.envidoAwarded) {
      newScores[hand.envidoResult.winner] += hand.envidoResult.points;
      // Marcar como adjudicado
      hand.envidoAwarded = true;
    }

    if (newScores[0] >= state.maxPoints) return { ...state, teamScores: newScores, phase: 'game_over', winner: 0 };
    if (newScores[1] >= state.maxPoints) return { ...state, teamScores: newScores, phase: 'game_over', winner: 1 };

    return { ...state, teamScores: newScores, phase: 'hand_end', hand };
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
