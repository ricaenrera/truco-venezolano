import type { Card, Baza, PlayedCard } from './types';
import type { PericopalosInfo } from './deck';
import { isPerico } from './deck';

// Jerarquía del Truco Venezolano (índice menor = carta más fuerte)
const TRUCO_ORDER: Array<{ number: number; suit: string | null }> = [
  { number: 1,  suit: 'espadas' }, // 0  — As de espadas
  { number: 1,  suit: 'bastos'  }, // 1  — As de bastos
  { number: 7,  suit: 'espadas' }, // 2  — 7 de espadas
  { number: 7,  suit: 'oros'    }, // 3  — 7 de oros
  { number: 3,  suit: null      }, // 4  — 3s
  { number: 2,  suit: null      }, // 5  — 2s
  { number: 1,  suit: 'copas'   }, // 6  — As de copas
  { number: 1,  suit: 'oros'    }, // 7  — As de oros
  { number: 12, suit: null      }, // 8  — Rey
  { number: 11, suit: null      }, // 9  — Caballo
  { number: 10, suit: null      }, // 10 — Sota
  { number: 7,  suit: 'copas'   }, // 11 — 7 de copas
  { number: 7,  suit: 'bastos'  }, // 12 — 7 de bastos
  { number: 6,  suit: null      }, // 13 — 6s
  { number: 5,  suit: null      }, // 14 — 5s
  { number: 4,  suit: null      }, // 15 — 4s
];

export function trucoRank(card: Card): number {
  for (let i = 0; i < TRUCO_ORDER.length; i++) {
    const entry = TRUCO_ORDER[i];
    if (entry.number === card.number) {
      if (entry.suit === null || entry.suit === card.suit) return i;
    }
  }
  return 99;
}

// Rango efectivo incluyendo Perico (carta más fuerte del juego cuando aplica)
// Perico = el 11 de la pinta de la vira (o el 12 si la vira es 11)
export function effectiveTrucoRank(card: Card, pericopalos: PericopalosInfo): number {
  if (isPerico(card, pericopalos)) return -1; // Perico: más fuerte que todo
  return trucoRank(card);
}

// 1 = A gana, -1 = B gana, 0 = emparde
export function compareCards(a: Card, b: Card, pericopalos?: PericopalosInfo): 1 | -1 | 0 {
  const ra = pericopalos ? effectiveTrucoRank(a, pericopalos) : trucoRank(a);
  const rb = pericopalos ? effectiveTrucoRank(b, pericopalos) : trucoRank(b);
  if (ra < rb) return 1;
  if (ra > rb) return -1;
  return 0;
}

// Determina el ganador de una baza, considerando Perico si se proveen pericopalos.
export function determineBazaWinner(
  plays: PlayedCard[],
  pericopalos?: PericopalosInfo
): Pick<Baza, 'winnerId' | 'isEmparde'> {
  if (plays.length === 0) return { winnerId: null, isEmparde: false };

  let best = plays[0];
  let isEmparde = false;

  for (let i = 1; i < plays.length; i++) {
    const cmp = compareCards(plays[i].card, best.card, pericopalos);
    if (cmp === 1) {
      best = plays[i];
      isEmparde = false;
    } else if (cmp === 0) {
      isEmparde = true;
    }
  }

  if (isEmparde) return { winnerId: null, isEmparde: true };
  return { winnerId: best.playerId, isEmparde: false };
}

// Puntos de "no quiero" para truco por nivel de canto
export const TRUCO_NO_QUIERO_POINTS: Record<string, number> = {
  truco:      1,
  retruco:    3,
  vale_nueve: 6,
  vale_juego: 9,
};

// Puntos de "quiero" para truco por nivel de canto
export const TRUCO_QUIERO_POINTS: Record<string, number> = {
  truco:      3,
  retruco:    6,
  vale_nueve: 9,
  // vale_juego = puntos para ganar (calculado dinámicamente)
};
