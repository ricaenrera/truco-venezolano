import type { Card, CardNumber, Suit } from './types';

// Spanish deck: 40 cards (1-7, 10-12 per suit — 8 and 9 excluded)
export const SUITS: Suit[] = ['espadas', 'bastos', 'copas', 'oros'];
export const NUMBERS: CardNumber[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

export function makeCard(number: CardNumber, suit: Suit): Card {
  return { number, suit, id: `${number}-${suit}` };
}

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const num of NUMBERS) {
      deck.push(makeCard(num, suit));
    }
  }
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function deal(deck: Card[], playerCount: 2 | 4): {
  hands: Card[][];
  vira: Card;
  remaining: Card[];
} {
  const shuffled = shuffle(deck);
  const hands: Card[][] = [];

  // Deal 3 cards per player, one by one (standard dealing order)
  for (let i = 0; i < playerCount; i++) hands.push([]);
  for (let round = 0; round < 3; round++) {
    for (let p = 0; p < playerCount; p++) {
      hands[p].push(shuffled.shift()!);
    }
  }

  const vira = shuffled.shift()!;
  return { hands, vira, remaining: shuffled };
}

// ─── Perico / Perica resolution ──────────────────────────────────────────────

export interface PericopalosInfo {
  perico: Card;  // worth 30 in envido
  perica: Card;  // worth 29 in envido
}

export function resolvePericopalos(vira: Card): PericopalosInfo {
  const suit = vira.suit;

  if (vira.number === 10) {
    // Vira is 10 (sota): Perica = 12 of same suit (29), Perico = 11 of same suit (30)
    return {
      perico: makeCard(11, suit),
      perica: makeCard(12, suit),
    };
  }

  if (vira.number === 11) {
    // Vira is 11 (caballo): Perico = 12 of same suit (30), Perica = 10 of same suit (29)
    return {
      perico: makeCard(12, suit),
      perica: makeCard(10, suit),
    };
  }

  // Normal case: Perico = 11 of same suit, Perica = 10 of same suit
  return {
    perico: makeCard(11, suit),
    perica: makeCard(10, suit),
  };
}

export function isPerico(card: Card, pericopalos: PericopalosInfo): boolean {
  return card.id === pericopalos.perico.id;
}

export function isPerica(card: Card, pericopalos: PericopalosInfo): boolean {
  return card.id === pericopalos.perica.id;
}

export function isFigure(card: Card): boolean {
  return card.number === 10 || card.number === 11 || card.number === 12;
}
