/** Effets sonores d'appel générés via la Web Audio API (aucun fichier requis). */

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  void ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(freq: number, start: number, duration: number, volume = 0.18) {
  const ac = audioCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const t0 = ac.currentTime + start;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.setValueAtTime(volume, t0 + duration - 0.05);
  gain.gain.linearRampToValueAtTime(0, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Son court et montant : l'appel démarre / est accepté. */
export function playCallStart() {
  tone(523.25, 0, 0.12);
  tone(783.99, 0.12, 0.18);
}

/** Son court et descendant : l'appel est terminé. */
export function playCallEnd() {
  tone(440, 0, 0.14);
  tone(311.13, 0.14, 0.22);
}

/** Tonalité d'attente répétée pendant la sonnerie. Retourne une fonction d'arrêt. */
export function startRingTone(mode: "outgoing" | "incoming" = "outgoing") {
  let stopped = false;
  const beat = () => {
    if (stopped) return;
    if (mode === "outgoing") {
      tone(440, 0, 0.9, 0.1);
    } else {
      tone(880, 0, 0.35, 0.14);
      tone(880, 0.5, 0.35, 0.14);
    }
  };
  beat();
  const timer = window.setInterval(beat, mode === "outgoing" ? 2600 : 1800);
  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}
