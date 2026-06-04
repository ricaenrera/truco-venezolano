'use client';
import type { Player } from '@/game/types';
import CardComponent from './CardComponent';

const FAKE_CARD = { number: 1 as const, suit: 'espadas' as const, id: 'fake' };

export default function PlayerSlot({ player, cardCount, isCurrentTurn, vertical }: {
  player: Player; cardCount: number; isCurrentTurn: boolean; vertical?: boolean;
}) {
  const cards = Array.from({ length: cardCount }, (_, i) => ({ ...FAKE_CARD, id: `fake-${i}` }));

  return (
    <div className={`flex ${vertical ? 'flex-row' : 'flex-col'} items-center gap-2 p-2`}>
      <div className="flex flex-col items-center gap-1">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-black ${isCurrentTurn ? 'bg-gold turn-indicator' : 'bg-primary/60'}`}>
          {player.name[0]?.toUpperCase()}
        </div>
        <span className={`text-xs max-w-16 truncate ${isCurrentTurn ? 'text-gold font-bold' : 'text-gray-400'}`}>
          {player.name}
        </span>
      </div>
      <div className={`flex ${vertical ? 'flex-col' : 'flex-row'} gap-1`}>
        {cards.slice(0, 3).map((c) => (
          <CardComponent key={c.id} card={c} faceDown size="sm" />
        ))}
      </div>
    </div>
  );
}
