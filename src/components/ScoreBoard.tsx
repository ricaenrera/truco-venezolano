'use client';

export default function ScoreBoard({ scores, maxPoints }: { scores: [number, number]; maxPoints: number }) {
  return (
    <div className="flex items-center justify-between px-6 py-3 bg-black/40 border-b border-white/10">
      <TeamScore label="Nosotros" score={scores[0]} max={maxPoints} color="text-green-400" barColor="bg-green-400" />
      <div className="text-center">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Truco</p>
        <p className="text-gold font-bold">🃏 {maxPoints}pts</p>
      </div>
      <TeamScore label="Ellos" score={scores[1]} max={maxPoints} color="text-red-400" barColor="bg-red-400" />
    </div>
  );
}

function TeamScore({ label, score, max, color, barColor }: {
  label: string; score: number; max: number; color: string; barColor: string;
}) {
  return (
    <div className="text-center w-28">
      <p className={`text-3xl font-bold ${color}`}>{score}</p>
      <div className="w-full h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min((score / max) * 100, 100)}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
