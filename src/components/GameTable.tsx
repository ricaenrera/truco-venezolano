'use client';
import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import type { Card, CantoType, CantoResponse, EnvidoCanto } from '@/game/types';
import CardComponent from './CardComponent';
import ScoreBoard from './ScoreBoard';
import CantoButtons from './CantoButtons';
import PlayerSlot from './PlayerSlot';

interface GameTableProps {
  myId: string;
}

export default function GameTable({ myId }: GameTableProps) {
  const { game, dispatch, notification } = useGameStore();
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  if (!game?.hand) return null;

  const hand = game.hand;
  const myCards = hand.hands[myId] ?? [];
  const isMyTurn = hand.currentTurnPlayerId === myId;
  const canPlay = isMyTurn && game.phase === 'playing';

  const me = game.players.find((p) => p.id === myId);
  const others = game.players.filter((p) => p.id !== myId);
  const top = others.find((p) => p.position === 2);
  const right = others.find((p) => p.position === 1);
  const left = others.find((p) => p.position === 3);

  const handleCardClick = (card: Card) => {
    if (!canPlay) return;
    if (selectedCard === card.id) {
      dispatch({ type: 'PLAY_CARD', playerId: myId, payload: { card } }, myId);
      setSelectedCard(null);
    } else {
      setSelectedCard(card.id);
    }
  };

  const handleCanto = (type: CantoType) => {
    if (type === 'truco' || type === 'retruco' || type === 'vale_nueve' || type === 'vale_juego') {
      dispatch({ type: 'SING_TRUCO', playerId: myId, payload: { canto: type } }, myId);
    } else if (type === 'flor') {
      dispatch({ type: 'SING_FLOR', playerId: myId }, myId);
    } else if (type === 'mazo') {
      if (confirm('¿Seguro que quieres irte al mazo?')) {
        dispatch({ type: 'GO_TO_MAZO', playerId: myId }, myId);
      }
    } else {
      dispatch({ type: 'SING_ENVIDO', playerId: myId, payload: { canto: type as EnvidoCanto } }, myId);
    }
  };

  const handleRespond = (response: CantoResponse, piedrasPoints?: number) => {
    dispatch({ type: 'RESPOND_CANTO', playerId: myId, payload: { response, piedrasPoints } }, myId);
  };

  const myTeam = me?.team ?? 0;

  return (
    <div className="h-screen flex flex-col felt-table overflow-hidden select-none">
      {/* Score */}
      <ScoreBoard scores={game.teamScores} maxPoints={game.maxPoints} />

      {/* Overlay comparación de envido — solo al final de la mano */}
      {hand.envidoResult && (game.phase === 'hand_end' || game.phase === 'game_over') && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75">
          <div className="bg-[#182618] border border-[#2a3d2c] rounded-2xl p-5 w-full max-w-xs mx-4 shadow-2xl">
            <h3 className="text-base font-bold text-center text-yellow-300 mb-4">🃏 Envido</h3>

            {game.players.map((player) => {
              const score = hand.envidoResult!.teamScores[player.team];
              const playerCards: Card[] = hand.envidoResult!.envidoCards[player.id] ?? [];
              const isWinner = player.team === hand.envidoResult!.winner;
              const isMe = player.id === myId;

              return (
                <div key={player.id}
                  className={`mb-3 p-3 rounded-xl border ${isWinner
                    ? 'border-green-400 bg-green-400/10'
                    : 'border-[#2a3d2c] bg-black/20'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">
                      {isMe ? 'Tú' : player.name}
                      {isWinner && <span className="ml-1 text-green-400">✓</span>}
                    </span>
                    <span className={`text-xl font-bold ${isWinner ? 'text-green-400' : 'text-gray-400'}`}>
                      {score} pts
                    </span>
                  </div>
                  <div className="flex gap-1.5 justify-center">
                    {playerCards.map((card) => (
                      <CardComponent key={card.id} card={card} size="sm" />
                    ))}
                    {playerCards.length === 0 && (
                      <span className="text-xs text-gray-500">Sin par</span>
                    )}
                  </div>
                </div>
              );
            })}

            <p className="text-center text-sm mt-2 font-semibold text-yellow-300">
              +{hand.envidoResult.points} pts → {hand.envidoResult.winner === myTeam ? 'Tu equipo ganó' : 'Ellos ganaron'}
            </p>
          </div>
        </div>
      )}

      {/* Notificación de canto de la IA */}
      {notification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-black/85 border border-yellow-400/50 text-yellow-300 px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg pointer-events-none">
          {notification}
        </div>
      )}

      {/* Vira indicator */}
      {hand.vira && (
        <div className="absolute top-20 left-3 z-10 flex flex-col items-center gap-1">
          <CardComponent card={hand.vira} size="sm" />
          <span className="text-xs text-gold font-bold">Vira</span>
        </div>
      )}

      {/* Top player */}
      <div className="flex justify-center pt-2">
        {top ? (
          <PlayerSlot player={top} cardCount={hand.hands[top.id]?.length ?? 0}
            isCurrentTurn={hand.currentTurnPlayerId === top.id} />
        ) : <div className="h-20" />}
      </div>

      {/* Middle: left + play area + right */}
      <div className="flex-1 flex items-center px-2 gap-2">
        {left && (
          <PlayerSlot player={left} cardCount={hand.hands[left.id]?.length ?? 0}
            isCurrentTurn={hand.currentTurnPlayerId === left.id} vertical />
        )}

        {/* Play area — todas las cartas jugadas en la mano */}
        <div className="flex-1 flex flex-col justify-center gap-2 rounded-xl bg-black/20 border border-white/5 p-3 overflow-auto">
          {hand.bazas.length === 0 && hand.currentBaza.length === 0 && (
            <p className="text-gray-600 text-sm text-center">Mesa vacía</p>
          )}

          {/* Bazas completadas */}
          {hand.bazas.map((baza, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 w-4 shrink-0">{idx + 1}</span>
              <div className="flex gap-1 flex-wrap">
                {baza.plays.map((played) => (
                  <div key={played.playerId} className="flex flex-col items-center gap-0.5">
                    <CardComponent card={played.card} size="sm" />
                    <span className="text-[9px] text-gray-500 max-w-[36px] truncate text-center leading-tight">
                      {game.players.find((p) => p.id === played.playerId)?.name}
                    </span>
                  </div>
                ))}
              </div>
              <span className={`text-[10px] font-semibold ml-auto shrink-0 ${baza.isEmparde ? 'text-yellow-400' : 'text-primary'}`}>
                {baza.isEmparde ? 'Emparde' : `${game.players.find((p) => p.id === baza.winnerId)?.name ?? ''} ✓`}
              </span>
            </div>
          ))}

          {/* Baza en curso */}
          {hand.currentBaza.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 w-4 shrink-0">{hand.bazas.length + 1}</span>
              <div className="flex gap-1 flex-wrap">
                {hand.currentBaza.map((played) => (
                  <div key={played.playerId} className="flex flex-col items-center gap-0.5">
                    <CardComponent card={played.card} size="sm" />
                    <span className="text-[9px] text-gray-500 max-w-[36px] truncate text-center leading-tight">
                      {game.players.find((p) => p.id === played.playerId)?.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {right && (
          <PlayerSlot player={right} cardCount={hand.hands[right.id]?.length ?? 0}
            isCurrentTurn={hand.currentTurnPlayerId === right.id} vertical />
        )}
      </div>

      {/* Turn indicator */}
      {isMyTurn && game.phase === 'playing' && (
        <div className="text-center">
          <span className="inline-block px-4 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold turn-indicator">
            Tu turno {selectedCard ? '— Toca de nuevo para jugar' : '— Selecciona una carta'}
          </span>
        </div>
      )}

      {/* Canto buttons */}
      <CantoButtons game={game} myPlayerId={myId} isMyTurn={isMyTurn}
        onCanto={handleCanto} onRespond={handleRespond} />

      {/* My hand */}
      <div className="bg-black/30 border-t border-white/10 py-3 px-2">
        <div className="flex justify-center gap-3 flex-wrap">
          {myCards.map((card) => (
            <CardComponent
              key={card.id}
              card={card}
              size="lg"
              selected={selectedCard === card.id}
              disabled={!canPlay}
              onClick={() => handleCardClick(card)}
            />
          ))}
          {myCards.length === 0 && (
            <p className="text-gray-500 text-sm py-4">Sin cartas</p>
          )}
        </div>
        {me && (
          <p className="text-center text-xs text-gray-500 mt-2">{me.name}</p>
        )}
      </div>
    </div>
  );
}
