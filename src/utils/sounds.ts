'use client';

// ─── Sonido al jugar carta (Web Audio API) ────────────────────────────────────

export function playCardSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();

    // Sonido de golpe seco al tirar una carta sobre la mesa
    const sampleRate = ctx.sampleRate;
    const duration = 0.12;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / buffer.length;
      // Ruido con decaimiento rápido → "thud" de carta
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 4) * 0.8;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = 0.5;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start();
    source.onended = () => ctx.close();
  } catch {
    // Silenciar cualquier error de audio
  }
}

// ─── Narración de cantos (Web Speech Synthesis) ───────────────────────────────

const CANTO_VOZ: Record<string, string> = {
  // Truco
  truco:         '¡Truco!',
  retruco:       '¡Retruco!',
  vale_nueve:    '¡Vale nueve!',
  vale_juego:    '¡Vale juego!',
  // Envido
  envido:        '¡Envido!',
  envido_envido: '¡Quiero, y envido!',
  falta_envido:  '¡Falta envido!',
  las_piedras:   '¡Las piedras!',
  // Otros
  flor:          '¡Flor!',
  flor_reservada:'¡Flor reservada!',
  prive:         '¡Privo!',
  mazo:          '¡Me voy al mazo!',
  barajo:        '¡Barajo!',
  // Respuestas
  quiero:        '¡Quiero!',
  no_quiero:     '¡No quiero!',
};

// Voces en español disponibles (se carga una vez)
let spanishVoices: SpeechSynthesisVoice[] = [];

function loadVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const all = window.speechSynthesis.getVoices();
  spanishVoices = all.filter((v) => v.lang.startsWith('es'));
}

// Ejecutar cuando las voces estén listas
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

export function speakCanto(canto: string, isHuman = true) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const text = CANTO_VOZ[canto];
  if (!text) return;

  // Cancelar cualquier narración en curso
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-VE';
  utterance.rate = 1.05;
  utterance.volume = 1.0;

  // Humano: tono normal. IA: tono ligeramente más bajo
  utterance.pitch = isHuman ? 1.1 : 0.85;

  // Usar voz en español si está disponible
  if (spanishVoices.length > 0) {
    // Preferir voces venezolanas o españolas
    const preferred = spanishVoices.find((v) => v.lang === 'es-VE' || v.lang === 'es-ES' || v.lang === 'es-MX')
      ?? spanishVoices[0];
    utterance.voice = preferred;
  }

  window.speechSynthesis.speak(utterance);
}

// Narrar con un número de piedras
export function speakPiedras(pts: number, isHuman = true) {
  speakCanto('las_piedras', isHuman);
  // Añadir el número después de un pequeño delay
  setTimeout(() => {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(`${pts} piedras`);
    u.lang = 'es-VE';
    u.rate = 1.05;
    u.pitch = isHuman ? 1.1 : 0.85;
    if (spanishVoices.length > 0) u.voice = spanishVoices[0];
    window.speechSynthesis.speak(u);
  }, 600);
}
