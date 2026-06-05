'use client';
import type { GameState, CantoType, CantoResponse } from '@/game/types';
import { canSingTruco, canSingEnvido } from '@/game/gameEngine';
import { hasFlor } from '@/game/envido';

interface Props {
  game: GameState; myPlayerId: string; isMyTurn: boolean;
  onCanto: (t: CantoType) => void;
  onRespond: (r: CantoResponse, piedrasPoints?: number) => void;
}

export default function CantoButtons({ game, myPlayerId, isMyTurn, onCanto, onRespond }: Props) {
  const hand = game.hand;
  if (!hand) return null;
  const me = game.players.find((p) => p.id === myPlayerId);
  if (!me) return null;

  const trucoNeedsResponse = hand.trucoCanto && hand.trucoCanto.byTeam !== me.team;
  const envidoNeedsResponse = hand.envidoCanto && hand.envidoCanto.byTeam !== me.team;

  if (trucoNeedsResponse) {
    const current = hand.trucoCanto!.type;
    return (
      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-black/30">
        <span className="text-xs text-gray-400 mr-2">Cantaron {current.replace('_', ' ').toUpperCase()}</span>
        <Btn label="✓ Quiero" color="bg-green-600 hover:bg-green-500" onClick={() => onRespond('quiero')} />
        <Btn label="✗ No quiero" color="bg-red-600 hover:bg-red-500" onClick={() => onRespond('no_quiero')} />
        {current === 'truco' && <Btn label="Retruco" color="bg-yellow-600 hover:bg-yellow-500 text-black" onClick={() => onRespond('retruco')} />}
        {current === 'retruco' && <Btn label="Vale Nueve" color="bg-yellow-600 hover:bg-yellow-500 text-black" onClick={() => onRespond('vale_nueve')} />}
        {current === 'vale_nueve' && <Btn label="Vale Juego" color="bg-yellow-600 hover:bg-yellow-500 text-black" onClick={() => onRespond('vale_juego')} />}
      </div>
    );
  }

  if (envidoNeedsResponse) {
    const envidoType = hand.envidoCanto!.type;
    const canEscalate = envidoType !== 'falta_envido' && envidoType !== 'las_piedras';
    const peri = { perico: hand.pericopalos.perico!, perica: hand.pericopalos.perica! };
    const myCards = hand.hands[myPlayerId] ?? [];
    const iHaveFlorToRespond = hasFlor(myCards, peri);

    const handlePiedras = () => {
      const raw = window.prompt('¿Cuántas piedras envidás? (número)');
      const pts = parseInt(raw ?? '');
      if (!isNaN(pts) && pts > 0) {
        onRespond('las_piedras', pts);
      }
    };

    return (
      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-black/30 flex-wrap">
        <span className="text-xs text-gray-400 mr-2">
          Cantaron {envidoType.replace(/_/g, ' ').toUpperCase()}
        </span>
        {iHaveFlorToRespond && (
          <Btn label="🌸 Flor" color="bg-purple-600 hover:bg-purple-500"
            onClick={() => onRespond('flor')} />
        )}
        <Btn label="✓ Quiero" color="bg-green-600 hover:bg-green-500" onClick={() => onRespond('quiero')} />
        <Btn label="✗ No quiero" color="bg-red-600 hover:bg-red-500" onClick={() => onRespond('no_quiero')} />
        {canEscalate && (
          <>
            {envidoType === 'envido' && (
              <Btn label="Quiero y Envido" color="bg-blue-600 hover:bg-blue-500" onClick={() => onRespond('envido_envido')} />
            )}
            <Btn label="Falta Envido" color="bg-yellow-600 hover:bg-yellow-500 text-black" onClick={() => onRespond('falta_envido')} />
            <Btn label="Las Piedras" color="bg-purple-600 hover:bg-purple-500" onClick={handlePiedras} />
          </>
        )}
      </div>
    );
  }

  if (!isMyTurn || game.phase !== 'playing') return null;

  const myCards = hand.hands[myPlayerId] ?? [];
  const nextTruco = canSingTruco(game, myPlayerId);
  const canEnvido = canSingEnvido(game, myPlayerId);
  const peri = { perico: hand.pericopalos.perico!, perica: hand.pericopalos.perica! };
  const iHaveFlor = hasFlor(myCards, peri) && !hand.envidoResolved;

  return (
    <div className="flex items-center justify-center gap-2 py-2 px-4 bg-black/30 flex-wrap">
      {nextTruco && !hand.trucoResolved && (
        <Btn label={nextTruco.replace('_', ' ').toUpperCase()} color="bg-yellow-500 hover:bg-yellow-400 text-black" onClick={() => onCanto(nextTruco)} />
      )}
      {canEnvido && !iHaveFlor && (
        <>
          <Btn label="Envido" color="bg-blue-600 hover:bg-blue-500" onClick={() => onCanto('envido')} />
          <Btn label="Falta Envido" color="bg-blue-800 hover:bg-blue-700" onClick={() => onCanto('falta_envido')} />
        </>
      )}
      {iHaveFlor && <Btn label="🌸 Flor" color="bg-purple-600 hover:bg-purple-500" onClick={() => onCanto('flor')} />}
      <Btn label="Al Mazo" color="bg-gray-700 hover:bg-gray-600" onClick={() => onCanto('mazo')} />
    </div>
  );
}

function Btn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 rounded-full text-white text-xs font-bold transition-colors ${color}`}>
      {label}
    </button>
  );
}
