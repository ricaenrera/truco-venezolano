// Reglas y constantes configurables del Truco venezolano (uso por IA y motor)
import type { PericopalosInfo } from './deck';

export const BLUFF_CHANCE = 0.12;

// Umbrales usados por la IA para decidir cantar o aceptar envidos
export const ENVIDO_MIN_SING = 20; // no cantar si < 20
export const ENVIDO_FALTA_THRESHOLD = 28; // cantar falta_envido si >=
export const ENVIDO_ACCEPT_THRESHOLD = 25; // aceptar envido si >=

// Puntos para truco por nivel
export const TRUCO_NO_QUIERO_POINTS: Record<string, number> = {
  truco:      1,
  retruco:    3,
  vale_nueve: 6,
  vale_juego: 9,
};

export const TRUCO_QUIERO_POINTS: Record<string, number> = {
  truco:      3,
  retruco:    6,
  vale_nueve: 9,
};

// Puntos de "no quiero" para envido/flores (sitios pueden referenciarlo)
export const ENVIDO_NO_QUIERO_POINTS: Record<string, number> = {
  envido:        1,
  envido_envido: 2,
  falta_envido:  1,
  las_piedras:   1,
  flor:          1,
};

// Exportar una función de ayuda (placeholder) si se requiere info del perico
export function pericopalosInfoDescription(peri: PericopalosInfo) {
  return `Perico: ${peri.perico.id}, Perica: ${peri.perica.id}`;
}

export default null;
