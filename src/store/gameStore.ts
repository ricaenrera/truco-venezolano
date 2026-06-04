'use client';
import { create } from 'zustand';
import type { GameState, GameAction, ChatMessage, GameMode } from '../game/types';
import { createInitialGameState, applyAction, startHand } from '../game/gameEngine';
import { getAIAction } from '../game/ai';
import { upsertGameState, insertGameAction, sendMessage, fetchMessages } from '../supabase/queries';

const AI_DELAY = 900;

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

interface GameStore {
  game: GameState | null;
  messages: ChatMessage[];
  notification: string | null;
  initLocalGame: (mode: GameMode, maxPoints: 12 | 24, humanName: string) => void;
  initOnlineGame: (state: GameState) => void;
  dispatch: (action: GameAction, myUserId?: string) => Promise<void>;
  syncFromServer: (raw: unknown) => void;
  startNextHand: () => void;
  sendChat: (userId: string, userName: string, content: string, isQuick?: boolean) => Promise<void>;
  loadMessages: (roomId: string) => Promise<void>;
  addMessage: (msg: ChatMessage) => void;
  reset: () => void;
}

function buildNotification(action: GameAction, players: GameState['players']): string | null {
  const player = players.find((p) => p.id === action.playerId);
  if (!player || player.isHuman) return null;
  const n = player.name;

  if (action.type === 'SING_TRUCO') {
    const labels: Record<string, string> = { truco: 'Truco', retruco: 'Retruco', vale_nueve: 'Vale nueve', vale_juego: 'Vale juego' };
    return `${n}: ¡${labels[action.payload?.canto ?? ''] ?? action.payload?.canto}!`;
  }
  if (action.type === 'SING_ENVIDO') {
    const labels: Record<string, string> = { envido: 'Envido', real_envido: 'Real envido', falta_envido: 'Falta envido' };
    return `${n}: ¡${labels[action.payload?.canto ?? ''] ?? action.payload?.canto}!`;
  }
  if (action.type === 'SING_FLOR') return `${n}: ¡Flor!`;
  if (action.type === 'GO_TO_MAZO') return `${n}: Se fue al mazo`;
  if (action.type === 'RESPOND_CANTO') {
    const resp = action.payload?.response ?? '';
    const labels: Record<string, string> = {
      quiero: '¡Quiero!', no_quiero: 'No quiero',
      retruco: '¡Retruco!', vale_nueve: '¡Vale nueve!', vale_juego: '¡Vale juego!',
      falta_envido: '¡Falta envido!', envido_envido: '¡Envido y envido!',
      las_piedras: `¡${action.payload?.piedrasPoints ?? '?'} piedras!`,
    };
    return `${n}: ${labels[resp] ?? resp}`;
  }
  return null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  messages: [],
  notification: null,

  initLocalGame: (mode, maxPoints, humanName) => {
    const is4p = mode === 'local_4p';
    const players = [
      { id: 'human', name: humanName, avatarId: 0, isHuman: true, isOnline: false, position: 0 as const, team: 0 as const },
      { id: 'ai1', name: 'Bot 1', avatarId: 1, isHuman: false, isOnline: false, position: 1 as const, team: 1 as const },
      ...(is4p ? [
        { id: 'ai2', name: 'Compañero', avatarId: 2, isHuman: false, isOnline: false, position: 2 as const, team: 0 as const },
        { id: 'ai3', name: 'Bot 2', avatarId: 3, isHuman: false, isOnline: false, position: 3 as const, team: 1 as const },
      ] : []),
    ];
    const game = createInitialGameState(players, mode, maxPoints);
    set({ game, messages: [] });
    setTimeout(() => get().startNextHand(), 400);
  },

  initOnlineGame: (state) => set({ game: state, messages: [] }),

  dispatch: async (action, myUserId) => {
    const { game } = get();
    if (!game) return;
    const newState = applyAction(game, action);

    // Notificación para acciones de la IA
    const notif = buildNotification(action, game.players);
    set({ game: newState, ...(notif ? { notification: notif } : {}) });
    if (notif) {
      setTimeout(() => set((s) => s.notification === notif ? { notification: null } : {}), 3000);
    }

    if (game.roomId) {
      await upsertGameState(game.roomId, newState);
      if (myUserId) await insertGameAction(game.roomId, myUserId, action.type, action.payload ?? {});
    }

    // Avanzar a la siguiente mano automáticamente (desde el store, no desde React)
    if (newState.phase === 'hand_end') {
      setTimeout(() => {
        const current = get().game;
        if (current?.phase === 'hand_end') get().startNextHand();
      }, 1800);
      return; // no programar IA durante hand_end
    }

    if (!game.roomId) scheduleAI(newState, myUserId ?? 'human');
  },

  syncFromServer: (raw) => set({ game: raw as GameState }),

  startNextHand: () => {
    const { game } = get();
    if (!game) return;
    const newState = startHand(game);
    set({ game: newState });
    if (!game.roomId) scheduleAI(newState, 'human');
  },

  sendChat: async (userId, userName, content, isQuick = false) => {
    const { game } = get();
    const msg: ChatMessage = { id: generateId(), userId, userName, content, createdAt: new Date().toISOString(), isQuickReply: isQuick };
    set((s) => ({ messages: [...s.messages, msg] }));
    if (game?.roomId) await sendMessage(game.roomId, userId, content, isQuick);
  },

  loadMessages: async (roomId) => {
    const rows = await fetchMessages(roomId);
    const messages: ChatMessage[] = (rows as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, userId: r.user_id as string,
      userName: ((r.profiles as Record<string, unknown>)?.username as string) ?? 'Jugador',
      content: r.content as string, createdAt: r.created_at as string, isQuickReply: r.is_quick_reply as boolean,
    }));
    set({ messages });
  },

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  reset: () => set({ game: null, messages: [] }),
}));

function scheduleAI(state: GameState, humanId: string) {
  if (!state.hand) return;
  if (state.phase === 'game_over' || state.phase === 'hand_end') return;

  // Si hay un canto pendiente (envido o truco cantado por el humano),
  // buscar qué IA necesita responder — aunque no sea su "turno" de carta.
  if (state.phase === 'canto') {
    const hand = state.hand;
    const respondingAI = state.players.find((p) => {
      if (p.isHuman) return false;
      const trucoPending = hand.trucoCanto && hand.trucoCanto.byTeam !== p.team;
      const envidoPending = hand.envidoCanto && hand.envidoCanto.byTeam !== p.team;
      return trucoPending || envidoPending;
    });
    if (!respondingAI) return;

    setTimeout(async () => {
      const { game, dispatch } = useGameStore.getState();
      if (!game || game.phase !== 'canto') return;
      const action = getAIAction(game, respondingAI.id);
      if (action) await dispatch(action, humanId);
    }, AI_DELAY);
    return;
  }

  // Turno normal de la IA
  const currentId = state.hand.currentTurnPlayerId;
  if (!currentId) return;
  const current = state.players.find((p) => p.id === currentId);
  if (!current || current.isHuman) return;

  setTimeout(async () => {
    const { game, dispatch } = useGameStore.getState();
    if (!game) return;
    const id = game.hand?.currentTurnPlayerId;
    if (!id) return;
    const player = game.players.find((p) => p.id === id);
    if (!player || player.isHuman) return;
    const action = getAIAction(game, id);
    if (action) await dispatch(action, humanId);
  }, AI_DELAY);
}
