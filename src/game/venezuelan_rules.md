# Reglas principales del Truco venezolano (resumen)

Este archivo resume las reglas implementadas en el código del proyecto.

- Baraja: española de 40 cartas (1-7, 10-12). Pintas: espadas, bastos, copas, oros.
- Perico / Perica: cartas especiales determinadas por la `vira`.
  - Perico: 11 de la pinta de la vira (o 12 si la vira es 11) — vale 30 en envido.
  - Perica: 10 de la pinta de la vira (o 10/12 según vira) — vale 29 en envido.

- Envido:
  - Valores: 1–7 = valor nominal; figuras normales (10,11,12) = 0; Perico=30, Perica=29.
  - Si tienes dos cartas de la misma pinta: suma de valores + 20.
  - Los wildcards (Perico/Perica) actúan como comodines de pinta y eligen la mejor pareja.
  - Flor: tres cartas de la misma pinta (los wildcards pueden completar una flor).
  - Flor reservada: Perico + Perica + cualquier carta = 5 puntos automáticos.

- Truco (jerarquía de cartas):
  - Orden (más fuerte → más débil): As espadas, As bastos, 7 espadas, 7 oros, 3s, 2s, As copas, As oros, Rey(12), Caballo(11), Sota(10), 7 copas, 7 bastos, 6s, 5s, 4s.
  - Perico (cuando aplica) se considera más fuerte que todo.

- Cantos y puntos:
  - Envido, envido_envido, falta_envido, las_piedras — puntos según tabla.
  - Truco → retruco → vale_nueve → vale_juego (puntos escalonados; `rules.ts` centraliza tablas).

- Resolución de bazas y empardes:
  - Se comparan cartas con la jerarquía; emparde = ninguna carta gana la baza.
  - Reglas especiales para 4 jugadores con emparde en 1ª baza (salto a 3ª).
  - Regla "primera manda": ganador de la primera baza decisiva tiene ventaja en empardes.

Esta información fue sintetizada a partir de los módulos:

- `src/game/deck.ts` — construcción de mazo y resolución de pericopalos.
- `src/game/envido.ts` — cálculo de envido, flor y puntos asociados.
- `src/game/trucoRank.ts` — jerarquía de cartas y determinación de baza ganadora.
- `src/game/gameEngine.ts` — flujo de la mano, cantos y resolución.
- `src/game/ai.ts` — heurísticas de IA (umbrales y comportamiento).

Si quieres, puedo:

- Extraer más detalles textuales del PDF en `Libro de reglas` (si confirmas que es el documento correcto).
- Ajustar los umbrales de la IA o ampliar la base de conocimiento (JSON/TS) para entrenamiento.
