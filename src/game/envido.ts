import type { Card, Suit } from './types';
import type { PericopalosInfo } from './deck';
import { isPerico, isPerica, isFigure } from './deck';

// ─── Valor de carta en envido ─────────────────────────────────────────────────

export function envidoValue(card: Card, pericopalos: PericopalosInfo): number {
  if (isPerico(card, pericopalos)) return 30;
  if (isPerica(card, pericopalos)) return 29;
  if (isFigure(card)) return 0;
  return card.number;
}

// ─── Detección de flor (incluyendo Perico/Perica como comodines de pinta) ─────

// Perico y Perica actúan como COMODÍN de pinta.
// Flor = 3 cartas que pueden ser de la misma pinta (wildcards se adaptan).
// Casos:
//   - 3 cartas de la misma pinta          → flor normal
//   - 2 de la misma pinta + 1 wildcard    → flor (wildcard adopta esa pinta)
//   - 1 carta + 2 wildcards               → flor (wildcards adoptan la pinta de la carta)
//   - 3 wildcards                          → flor (imposible: solo 2 wildcards existen)
export function hasFlor(hand: Card[], pericopalos: PericopalosInfo): boolean {
  if (hand.length < 3) return false;
  const normals = hand.filter((c) => !isPerico(c, pericopalos) && !isPerica(c, pericopalos));
  // Si hay 0 o 1 carta normal, los wildcards se adaptan → siempre flor
  if (normals.length <= 1) return true;
  // Si hay 2+ cartas normales, deben ser todas de la misma pinta
  const firstSuit = normals[0].suit;
  return normals.every((c) => c.suit === firstSuit);
}

// Mantenida por compatibilidad — ahora delega en hasFlor
export function hasFlorConPericopalos(hand: Card[], pericopalos: PericopalosInfo): boolean {
  return hasFlor(hand, pericopalos);
}

// Flor Reservada: Perico + Perica + cualquier carta → 5 puntos automáticos
export function hasFlorReservada(hand: Card[], pericopalos: PericopalosInfo): boolean {
  if (hand.length < 3) return false;
  return hand.some((c) => isPerico(c, pericopalos)) && hand.some((c) => isPerica(c, pericopalos));
}

// ─── Puntaje de envido (Perico/Perica son comodines de pinta) ─────────────────

// Reglas:
// - Cartas normales: se agrupan por pinta; par de la misma pinta = suma + 20
// - Wildcard (Perico/Perica): se empareja con CUALQUIER carta (elige la mejor combinación)
// - 2 wildcards: se emparejan entre sí → 30 + 29 + 20 = 79

export function calculateEnvido(hand: Card[], pericopalos: PericopalosInfo): number {
  if (hand.length === 0) return 0;

  const wildcards = hand.filter((c) => isPerico(c, pericopalos) || isPerica(c, pericopalos));
  const normals  = hand.filter((c) => !isPerico(c, pericopalos) && !isPerica(c, pericopalos));

  let best = 0;

  // ── Los 2 wildcards se emparejan entre sí ────────────────────────────────────
  if (wildcards.length >= 2) {
    const wv0 = envidoValue(wildcards[0], pericopalos);
    const wv1 = envidoValue(wildcards[1], pericopalos);
    best = Math.max(best, wv0 + wv1 + 20);
  }

  // ── Un wildcard se empareja con la mejor carta normal ────────────────────────
  for (const wc of wildcards) {
    const wv = envidoValue(wc, pericopalos);
    // Opción: wildcard solo (sin par)
    best = Math.max(best, wv);
    // Opción: wildcard + cada carta normal (wildcard adopta su pinta)
    for (const nc of normals) {
      best = Math.max(best, wv + envidoValue(nc, pericopalos) + 20);
    }
  }

  // ── Pares de cartas normales de la misma pinta ───────────────────────────────
  const suits = new Set<Suit>(normals.map((c) => c.suit));
  for (const suit of suits) {
    const ofSuit = normals.filter((c) => c.suit === suit);
    const values = ofSuit.map((c) => envidoValue(c, pericopalos)).sort((a, b) => b - a);

    if (ofSuit.length >= 2) {
      best = Math.max(best, values[0] + values[1] + 20);
    } else {
      best = Math.max(best, values[0]);
    }
  }

  // ── Carta normal individual (si no hay ningún par ni wildcard) ───────────────
  for (const nc of normals) {
    best = Math.max(best, envidoValue(nc, pericopalos));
  }

  return best;
}

// ─── Puntaje de flor ──────────────────────────────────────────────────────────

export function florScore(hand: Card[], pericopalos: PericopalosInfo): number {
  return hand.reduce((sum, c) => sum + envidoValue(c, pericopalos), 0);
}

// ─── Prive ────────────────────────────────────────────────────────────────────

export function isPriving(scores: [number, number], maxPoints: number, team: 0 | 1): boolean {
  return maxPoints - scores[team] === 1;
}

export function priveScore(hand: Card[], pericopalos: PericopalosInfo): number {
  return calculateEnvido(hand, pericopalos);
}

// ─── Falta envido ─────────────────────────────────────────────────────────────

export function faltaEnvidoPoints(scores: [number, number], maxPoints: number): number {
  const leader = Math.max(scores[0], scores[1]);
  return maxPoints - leader;
}

// ─── Vale juego ───────────────────────────────────────────────────────────────

export function valeJuegoPoints(scores: [number, number], maxPoints: number): number {
  const leader = Math.max(scores[0], scores[1]);
  return maxPoints - leader;
}

// ─── Tablas de puntos ─────────────────────────────────────────────────────────

export const ENVIDO_NO_QUIERO_POINTS: Record<string, number> = {
  envido:        1,
  envido_envido: 2,
  real_envido:   2,
  falta_envido:  1,
  las_piedras:   1,
  flor:          1,
};
