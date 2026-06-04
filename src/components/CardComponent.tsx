'use client';
import type { Card } from '@/game/types';

// ── Suit palette (based on Venezuelan Spanish deck) ───────────────────────────
const SUIT = {
  espadas: { primary: '#1e40af', light: '#93c5fd', bg: '#f0f7ff', border: '#3b82f6' },
  copas:   { primary: '#991b1b', light: '#fca5a5', bg: '#fff5f5', border: '#ef4444' },
  bastos:  { primary: '#166534', light: '#86efac', bg: '#f0fdf4', border: '#22c55e' },
  oros:    { primary: '#78350f', light: '#fcd34d', bg: '#fffbeb', border: '#f59e0b' },
};

const NUM_LABEL: Record<number, string> = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  10: '10', 11: '11', 12: '12',
};

const FACE_LABEL: Record<number, string> = { 10: 'Sota', 11: 'Caballo', 12: 'Rey' };

// ── Suit symbol SVGs ──────────────────────────────────────────────────────────

function Espada({ w = 10, h = 18, color }: { w?: number; h?: number; color: string }) {
  return (
    <svg width={w} height={h} viewBox="0 0 10 18" fill="none">
      <polygon points="5,1 3.5,5 6.5,5" fill={color}/>
      <rect x="4.4" y="5" width="1.2" height="7.5" fill={color}/>
      <rect x="1.5" y="9.5" width="7" height="1.5" rx="0.75" fill={color}/>
      <rect x="4.2" y="13" width="1.6" height="3" rx="0.8" fill="#5b3a00"/>
      <ellipse cx="5" cy="16.5" rx="2" ry="1" fill="#7c4a00"/>
    </svg>
  );
}

function Copa({ w = 12, h = 16, color }: { w?: number; h?: number; color: string }) {
  return (
    <svg width={w} height={h} viewBox="0 0 12 16" fill="none">
      <path d="M2,2 Q2,9 6,10.5 Q10,9 10,2 Z" fill={color}/>
      <path d="M2,2 Q2,9 6,10.5 Q10,9 10,2" stroke={color} strokeWidth="0.5" fill="none"/>
      <rect x="5.3" y="10.5" width="1.4" height="2.5" fill={color}/>
      <rect x="2.5" y="13" width="7" height="1.5" rx="0.7" fill={color}/>
    </svg>
  );
}

function Basto({ w = 8, h = 18, color }: { w?: number; h?: number; color: string }) {
  return (
    <svg width={w} height={h} viewBox="0 0 8 18" fill="none">
      <rect x="3" y="1" width="2.5" height="16" rx="1.25" fill={color}
        transform="rotate(-8 5 9)"/>
      <ellipse cx="4.2" cy="2" rx="1.8" ry="1.2" fill={color} transform="rotate(-8 4.2 2)"/>
      <ellipse cx="4.5" cy="16" rx="1.8" ry="1.2" fill={color} transform="rotate(-8 4.5 16)"/>
    </svg>
  );
}

function Oro({ size = 13, color, light }: { size?: number; color: string; light: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6.5" fill={color} stroke="#5b3a00" strokeWidth="0.5"/>
      <circle cx="7" cy="7" r="4.5" fill={light} opacity="0.7"/>
      <circle cx="7" cy="7" r="2.5" fill={color}/>
      <circle cx="7" cy="7" r="1" fill={light} opacity="0.9"/>
    </svg>
  );
}

// ── Number layout positions (x%, y%) in the card body ─────────────────────────

const POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[50, 25], [50, 75]],
  3: [[50, 20], [50, 50], [50, 80]],
  4: [[30, 28], [70, 28], [30, 72], [70, 72]],
  5: [[30, 22], [70, 22], [50, 50], [30, 78], [70, 78]],
  6: [[30, 20], [70, 20], [30, 50], [70, 50], [30, 80], [70, 80]],
  7: [[30, 18], [70, 18], [50, 33], [30, 50], [70, 50], [30, 75], [70, 75]],
};

// ── Face card figures ─────────────────────────────────────────────────────────

function SotaFigure({ color }: { color: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 60" fill="none">
      {/* Body */}
      <rect x="13" y="22" width="14" height="22" rx="3" fill={color} opacity="0.9"/>
      {/* Head */}
      <ellipse cx="20" cy="16" rx="7" ry="8" fill="#fde68a"/>
      {/* Hat */}
      <ellipse cx="20" cy="8" rx="8" ry="3" fill={color}/>
      <rect x="14" y="5" width="12" height="5" rx="2" fill={color}/>
      {/* Belt */}
      <rect x="13" y="32" width="14" height="2.5" fill={color} opacity="0.6"/>
      {/* Legs */}
      <rect x="14" y="44" width="5" height="10" rx="2" fill={color} opacity="0.8"/>
      <rect x="21" y="44" width="5" height="10" rx="2" fill={color} opacity="0.8"/>
      {/* Arms */}
      <rect x="5" y="24" width="8" height="3" rx="1.5" fill={color} opacity="0.8"/>
      <rect x="27" y="24" width="8" height="3" rx="1.5" fill={color} opacity="0.8"/>
    </svg>
  );
}

function CaballoFigure({ color }: { color: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 60" fill="none">
      {/* Horse body */}
      <ellipse cx="20" cy="40" rx="14" ry="9" fill="#a37b4a"/>
      {/* Horse head */}
      <ellipse cx="32" cy="30" rx="6" ry="8" fill="#a37b4a" transform="rotate(20 32 30)"/>
      {/* Rider body */}
      <rect x="14" y="20" width="12" height="15" rx="3" fill={color} opacity="0.9"/>
      {/* Rider head */}
      <ellipse cx="20" cy="14" rx="6" ry="7" fill="#fde68a"/>
      {/* Helmet */}
      <path d="M14,13 Q20,5 26,13" fill={color} stroke={color} strokeWidth="1"/>
      {/* Horse legs */}
      <rect x="8"  y="45" width="4" height="13" rx="2" fill="#8a6535"/>
      <rect x="14" y="46" width="4" height="12" rx="2" fill="#8a6535"/>
      <rect x="22" y="46" width="4" height="12" rx="2" fill="#8a6535"/>
      <rect x="28" y="45" width="4" height="13" rx="2" fill="#8a6535"/>
    </svg>
  );
}

function ReyFigure({ color }: { color: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 40 60" fill="none">
      {/* Robe */}
      <path d="M10,25 L8,58 L32,58 L30,25 Z" fill={color} opacity="0.85"/>
      {/* Body */}
      <rect x="13" y="22" width="14" height="18" rx="3" fill={color}/>
      {/* Head */}
      <ellipse cx="20" cy="15" rx="7" ry="8" fill="#fde68a"/>
      {/* Crown */}
      <rect x="12" y="6" width="16" height="4" fill="#f59e0b"/>
      <polygon points="12,6 14,1 16,6" fill="#f59e0b"/>
      <polygon points="19,6 20,1 21,6" fill="#f59e0b"/>
      <polygon points="24,6 26,1 28,6" fill="#f59e0b"/>
      {/* Crown gems */}
      <circle cx="14" cy="3" r="1" fill="#ef4444"/>
      <circle cx="20" cy="2" r="1" fill="#3b82f6"/>
      <circle cx="26" cy="3" r="1" fill="#ef4444"/>
      {/* Scepter arm */}
      <rect x="27" y="22" width="3" height="22" rx="1.5" fill={color} opacity="0.7"/>
      <circle cx="28.5" cy="21" r="3" fill="#f59e0b"/>
    </svg>
  );
}

// ── Sizes ─────────────────────────────────────────────────────────────────────

const DIM = {
  sm: { w: 38, h: 56, numSize: 9,  suitW: 7,  suitH: 12, cornerPad: 3 },
  md: { w: 58, h: 82, numSize: 12, suitW: 10, suitH: 16, cornerPad: 4 },
  lg: { w: 76, h: 108, numSize: 14, suitW: 13, suitH: 20, cornerPad: 5 },
};

interface CardProps {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  disabled?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
}

function SuitMark({ suit, w, h }: { suit: string; w: number; h: number }) {
  const s = SUIT[suit as keyof typeof SUIT];
  if (suit === 'espadas') return <Espada w={w} h={h} color={s.primary}/>;
  if (suit === 'copas')   return <Copa   w={w} h={h} color={s.primary}/>;
  if (suit === 'bastos')  return <Basto  w={w} h={h} color={s.primary}/>;
  if (suit === 'oros')    return <Oro    size={Math.min(w, h)} color={s.primary} light={s.light}/>;
  return null;
}

export default function CardComponent({ card, size = 'md', selected, disabled, faceDown, onClick }: CardProps) {
  if (faceDown) {
    const d = DIM[size];
    return (
      <div
        style={{ width: d.w, height: d.h, borderRadius: 6,
          background: 'linear-gradient(135deg, #1a4a2e 25%, #0d3b1e 75%)',
          border: '1px solid #2d7a4a', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}
      >
        <div style={{ width: d.w - 8, height: d.h - 8, borderRadius: 4,
          border: '1px solid #3d8a5a', opacity: 0.5,
          backgroundImage: 'repeating-linear-gradient(45deg, #1a4a2e 0, #1a4a2e 2px, transparent 0, transparent 50%)',
          backgroundSize: '6px 6px' }} />
      </div>
    );
  }

  const d = DIM[size];
  const s = SUIT[card.suit as keyof typeof SUIT];
  const label = NUM_LABEL[card.number] ?? String(card.number);
  const isFace = card.number >= 10;
  const positions = POSITIONS[card.number];

  const bodyH = d.h - d.cornerPad * 2 - d.numSize * 3;
  const bodyY = d.cornerPad + d.numSize * 1.5;

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      style={{
        width: d.w, height: d.h, flexShrink: 0,
        background: `linear-gradient(160deg, ${s.bg} 0%, #ffffff 100%)`,
        border: `1.5px solid ${selected ? '#f59e0b' : s.border}`,
        borderRadius: 6,
        boxShadow: selected
          ? `0 0 0 2px #f59e0b, 0 6px 16px rgba(0,0,0,0.4)`
          : '0 2px 6px rgba(0,0,0,0.3)',
        transform: selected ? 'translateY(-10px)' : undefined,
        cursor: !disabled && onClick ? 'pointer' : disabled ? 'not-allowed' : 'default',
        opacity: disabled ? 0.65 : 1,
        position: 'relative',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Corner top-left */}
      <div style={{ position: 'absolute', top: d.cornerPad, left: d.cornerPad, lineHeight: 1 }}>
        <div style={{ fontSize: d.numSize, fontWeight: 800, color: s.primary, lineHeight: 1 }}>{label}</div>
        <div style={{ marginTop: 1 }}>
          <SuitMark suit={card.suit} w={d.suitW * 0.8} h={d.suitH * 0.8} />
        </div>
      </div>

      {/* Corner bottom-right (rotated 180°) */}
      <div style={{ position: 'absolute', bottom: d.cornerPad, right: d.cornerPad, lineHeight: 1,
        transform: 'rotate(180deg)' }}>
        <div style={{ fontSize: d.numSize, fontWeight: 800, color: s.primary, lineHeight: 1 }}>{label}</div>
        <div style={{ marginTop: 1 }}>
          <SuitMark suit={card.suit} w={d.suitW * 0.8} h={d.suitH * 0.8} />
        </div>
      </div>

      {/* Card body */}
      {isFace ? (
        // Face card figure
        <div style={{ position: 'absolute', top: bodyY, left: d.cornerPad + 2,
          right: d.cornerPad + 2, height: bodyH, overflow: 'hidden' }}>
          {card.number === 10 && <SotaFigure color={s.primary} />}
          {card.number === 11 && <CaballoFigure color={s.primary} />}
          {card.number === 12 && <ReyFigure color={s.primary} />}
        </div>
      ) : (
        // Number card: grid of suit symbols
        <div style={{ position: 'absolute', top: bodyY, left: 0, right: 0, height: bodyH }}>
          {positions?.map(([px, py], i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${px}%`, top: `${py}%`,
              transform: 'translate(-50%, -50%)',
            }}>
              <SuitMark suit={card.suit} w={d.suitW} h={d.suitH} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
