import type { GameState, GameAction, Card, TrucoCanto, EnvidoCanto } from './types';
import {
  calculateEnvido, hasFlor, hasFlorConPericopalos,
  hasFlorReservada, faltaEnvidoPoints, isPriving,
} from './envido';
import { trucoRank, effectiveTrucoRank } from './trucoRank';
import { canSingEnvido, canSingFlor, canSingPrive, canSingTruco } from './gameEngine';

// Factor de aleatoriedad: 12% de probabilidad de farol o no cantar teniendo buenas cartas
const BLUFF_CHANCE = 0.12;

function bluff(): boolean {
  return Math.random() < BLUFF_CHANCE;
}

// ─── Punto de entrada principal ───────────────────────────────────────────────

export function getAIAction(state: GameState, aiPlayerId: string): GameAction | null {
  const hand = state.hand;
  if (!hand) return null;

  const player = state.players.find((p) => p.id === aiPlayerId);
  if (!player) return null;

  const myCards = hand.hands[aiPlayerId] ?? [];
  const pericopalos = { perico: hand.pericopalos.perico!, perica: hand.pericopalos.perica! };

  // ─── Responder canto pendiente ────────────────────────────────────────────
  if (state.phase === 'canto') {
    return respondToCanto(state, aiPlayerId);
  }

  if (hand.currentTurnPlayerId !== aiPlayerId) return null;

  // ─── Flor reservada: NO cantar (vale 5 automáticos) ──────────────────────
  const isFlorReservada = hasFlorReservada(myCards, pericopalos);
  if (isFlorReservada) {
    // La flor reservada ya se contabilizó al inicio de la mano — jugar carta directamente
    return playCard(state, aiPlayerId);
  }

  // ─── Flor normal: cantar SIEMPRE en primera ronda ────────────────────────
  if (canSingFlor(state, aiPlayerId) && !bluff()) {
    return { type: 'SING_FLOR', playerId: aiPlayerId };
  }

  // ─── Prive: cantar si aplica ──────────────────────────────────────────────
  if (canSingPrive(state, aiPlayerId)) {
    return { type: 'SING_PRIVE', playerId: aiPlayerId };
  }

  // ─── Envido: primera ronda, antes de la primera baza ─────────────────────
  if (canSingEnvido(state, aiPlayerId) && !hand.envidoCanto) {
    const envidoAction = decideSingEnvido(state, aiPlayerId, myCards, pericopalos);
    if (envidoAction) return envidoAction;
  }

  // ─── Truco: cualquier ronda ───────────────────────────────────────────────
  const nextTruco = canSingTruco(state, aiPlayerId);
  if (nextTruco && !hand.trucoCanto) {
    const trucoAction = decideSingTruco(state, aiPlayerId, myCards, nextTruco);
    if (trucoAction) return trucoAction;
  }

  // ─── Irse al mazo ─────────────────────────────────────────────────────────
  if (shouldGoToMazo(state, aiPlayerId, myCards)) {
    return { type: 'GO_TO_MAZO', playerId: aiPlayerId };
  }

  // ─── Jugar carta ──────────────────────────────────────────────────────────
  return playCard(state, aiPlayerId);
}

// ─── Decisión de envido ───────────────────────────────────────────────────────

function decideSingEnvido(
  state: GameState,
  aiPlayerId: string,
  myCards: Card[],
  pericopalos: { perico: Card; perica: Card }
): GameAction | null {
  if (bluff()) return null; // farol: a veces no cantar teniendo buen envido

  const score = calculateEnvido(myCards, pericopalos);

  // No cantar si puntaje < 20
  if (score < 20) return null;

  // Falta envido si puntaje muy alto
  if (score >= 28 && !bluff()) {
    return {
      type: 'SING_ENVIDO',
      playerId: aiPlayerId,
      payload: { canto: 'falta_envido' as EnvidoCanto },
    };
  }

  // Envido simple si puntaje moderado
  return {
    type: 'SING_ENVIDO',
    playerId: aiPlayerId,
    payload: { canto: 'envido' as EnvidoCanto },
  };
}

// ─── Decisión de truco ────────────────────────────────────────────────────────

function decideSingTruco(
  state: GameState,
  aiPlayerId: string,
  myCards: Card[],
  nextTruco: TrucoCanto
): GameAction | null {
  const hand = state.hand!;
  const peri = { perico: hand.pericopalos.perico!, perica: hand.pericopalos.perica! };
  const rank = (c: Card) => effectiveTrucoRank(c, peri);
  const bestRank = Math.min(...myCards.map(rank));
  const strongCards = myCards.filter((c) => rank(c) <= 3).length;
  const myTeam = state.players.find((p) => p.id === aiPlayerId)!.team;
  const myBazas = hand.bazas.filter((b) => b.winnerTeam === myTeam).length;
  const isFirstAction = hand.bazas.length === 0 && hand.currentBaza.length === 0;

  if (bluff()) return null;

  if (nextTruco === 'truco') {
    // Primera jugada de la mano: solo cantar con las 3 cartas más fuertes del mazo
    if (isFirstAction && bestRank <= 2) {
      return { type: 'SING_TRUCO', playerId: aiPlayerId, payload: { canto: 'truco' } };
    }
    // Después de ganar la primera baza: cantar con carta fuerte (rank ≤ 4)
    if (!isFirstAction && myBazas > 0 && bestRank <= 4) {
      return { type: 'SING_TRUCO', playerId: aiPlayerId, payload: { canto: 'truco' } };
    }
    // En tercera ronda con carta ganadora casi segura
    if (hand.currentRound === 3 && bestRank <= 3) {
      return { type: 'SING_TRUCO', playerId: aiPlayerId, payload: { canto: 'truco' } };
    }
  }

  // Retruco: solo si tiene 2+ cartas muy fuertes (rank ≤ 3)
  if (nextTruco === 'retruco' && strongCards >= 2) {
    return { type: 'SING_TRUCO', playerId: aiPlayerId, payload: { canto: 'retruco' } };
  }

  // Vale nueve / vale juego: solo con carta absolutamente ganadora
  if ((nextTruco === 'vale_nueve' || nextTruco === 'vale_juego') && bestRank <= 1) {
    return { type: 'SING_TRUCO', playerId: aiPlayerId, payload: { canto: nextTruco } };
  }

  return null;
}

// ─── Decisión de irse al mazo ─────────────────────────────────────────────────

function shouldGoToMazo(state: GameState, aiPlayerId: string, myCards: Card[]): boolean {
  const hand = state.hand!;
  if (!hand.trucoCanto) return false;

  const peri = { perico: hand.pericopalos.perico!, perica: hand.pericopalos.perica! };
  const rank = (c: Card) => effectiveTrucoRank(c, peri);
  const worstRank = Math.max(...myCards.map(rank));
  const pointsAtRisk = hand.trucoCanto.points;
  const myTeam = state.players.find((p) => p.id === aiPlayerId)!.team;
  const opponentTeam: 0 | 1 = myTeam === 0 ? 1 : 0;
  const opponentScore = state.teamScores[opponentTeam];

  if (worstRank >= 13 && myCards.every((c) => rank(c) >= 13) && !bluff()) return true;
  if (pointsAtRisk >= 6 && worstRank >= 10 && opponentScore + pointsAtRisk >= state.maxPoints) return true;

  return false;
}

// ─── Responder a cantos ───────────────────────────────────────────────────────

function respondToCanto(state: GameState, aiPlayerId: string): GameAction | null {
  const hand = state.hand!;
  const player = state.players.find((p) => p.id === aiPlayerId)!;
  const pericopalos = { perico: hand.pericopalos.perico!, perica: hand.pericopalos.perica! };
  const myCards = hand.hands[aiPlayerId] ?? [];

  const isTrucoPending = hand.trucoCanto && hand.trucoCanto.byTeam !== player.team;
  const isEnvidoPending = hand.envidoCanto && hand.envidoCanto.byTeam !== player.team;

  if (isTrucoPending) {
    const bestRank = myCards.length > 0 ? Math.min(...myCards.map((c) => effectiveTrucoRank(c, pericopalos))) : 99;

    // Escalar si tiene cartas muy fuertes y el canto lo permite
    const nextLevel = canSingTruco(state, aiPlayerId);
    if (nextLevel && bestRank <= 3 && !bluff()) {
      return {
        type: 'RESPOND_CANTO',
        playerId: aiPlayerId,
        payload: { response: nextLevel },
      };
    }

    // Querer si tiene carta buena (rank ≤ 6)
    const shouldAccept = bestRank <= 6 && !bluff();
    return {
      type: 'RESPOND_CANTO',
      playerId: aiPlayerId,
      payload: { response: shouldAccept ? 'quiero' : 'no_quiero' },
    };
  }

  if (isEnvidoPending) {
    const score = calculateEnvido(myCards, pericopalos);
    const canto = hand.envidoCanto!;

    // Subir a falta envido si puntaje muy alto
    if (score >= 28 && canto.type === 'envido' && !bluff()) {
      return {
        type: 'RESPOND_CANTO',
        playerId: aiPlayerId,
        payload: { response: 'falta_envido' },
      };
    }

    // Subir a envido si el canto fue solo envido y tengo más de 25
    if (score >= 25 && canto.type === 'envido' && !bluff()) {
      return {
        type: 'RESPOND_CANTO',
        playerId: aiPlayerId,
        payload: { response: 'envido_envido' },
      };
    }

    const shouldAccept = score >= 25 && !bluff();
    return {
      type: 'RESPOND_CANTO',
      playerId: aiPlayerId,
      payload: { response: shouldAccept ? 'quiero' : 'no_quiero' },
    };
  }

  return null;
}

// ─── Selección de carta ───────────────────────────────────────────────────────

function playCard(state: GameState, playerId: string): GameAction {
  const card = chooseCard(state, playerId);
  return { type: 'PLAY_CARD', playerId, payload: { card } };
}

function chooseCard(state: GameState, playerId: string): Card {
  const hand = state.hand!;
  const myCards = hand.hands[playerId];
  const currentBaza = hand.currentBaza;
  const myTeam = state.players.find((p) => p.id === playerId)!.team;

  const peri = { perico: hand.pericopalos.perico!, perica: hand.pericopalos.perica! };
  const rank = (c: Card) => effectiveTrucoRank(c, peri);

  // Primera ronda: jugar carta débil para guardar las fuertes
  if (hand.currentRound === 1 && currentBaza.length === 0) {
    return getWeakestCard(myCards, peri);
  }

  // Segunda ronda: si perdí la primera baza, jugar la más fuerte
  const myBazas = hand.bazas.filter((b) => b.winnerTeam === myTeam).length;
  if (hand.currentRound === 2 && myBazas === 0) {
    return getBestCard(myCards, peri) ?? myCards[0];
  }

  // Tercera ronda: siempre la mejor carta
  if (hand.currentRound === 3) {
    return getBestCard(myCards, peri) ?? myCards[0];
  }

  // Si hay cartas del oponente en la baza actual, intentar ganar con la mínima carta posible
  const opponentPlays = currentBaza.filter((p) => {
    const pl = state.players.find((pl2) => pl2.id === p.playerId);
    return pl && pl.team !== myTeam;
  });

  if (opponentPlays.length > 0) {
    const bestOpponentRank = Math.min(...opponentPlays.map((p) => rank(p.card)));
    const winning = myCards
      .filter((c) => rank(c) < bestOpponentRank)
      .sort((a, b) => rank(b) - rank(a));

    if (winning.length > 0) return winning[0];
    return getWeakestCard(myCards, peri);
  }

  return getWeakestCard(myCards, peri);
}

function getBestCard(cards: Card[], peri?: { perico: Card; perica: Card }): Card | undefined {
  const rank = (c: Card) => peri ? effectiveTrucoRank(c, peri) : trucoRank(c);
  return [...cards].sort((a, b) => rank(a) - rank(b))[0];
}

function getWeakestCard(cards: Card[], peri?: { perico: Card; perica: Card }): Card {
  const rank = (c: Card) => peri ? effectiveTrucoRank(c, peri) : trucoRank(c);
  return [...cards].sort((a, b) => rank(b) - rank(a))[0];
}
