/**
 * Web Audio output for the application.
 *
 * ## Why this is a module
 *
 * Three separate functions in `useNearbyController` each opened with the same
 * six lines: check a ref, lazily construct an `AudioContext`, resume it if the
 * browser had suspended it, then use it. That boilerplate was triplicated, and
 * each copy held its own reference to the same underlying context.
 *
 * More importantly, all three lived inside a hook that re-renders constantly, so
 * the context's lifetime was tied to a component's. An `AudioContext` is an
 * expensive browser resource — browsers cap how many a page may create, and on
 * iOS one created outside a user gesture starts suspended. Owning it here, at
 * module scope, means exactly one exists for the page and it is reused for the
 * life of the document.
 *
 * ## Autoplay policy
 *
 * Browsers — Safari especially — refuse to start an `AudioContext` until the
 * user has interacted with the page. `resume()` is therefore called before every
 * sound rather than once at startup: a context that failed to start during page
 * load will start correctly the first time it is used after a tap. Every
 * function here is safe to call at any time and never throws; audio failing is
 * never a reason to break a user flow.
 */

let ctx: AudioContext | null = null;

/** Get the shared context, creating it on first use. */
function context(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    // Safari suspends the context until a gesture; resuming on each use means a
    // sound attempted during page load does not permanently silence the app.
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * A short synthesised tone. Used as UI feedback throughout the app.
 *
 * Defaults produce a soft ~200 ms sine at conversational volume.
 */
export function triggerBeep(
  freq = 440,
  duration = 0.2,
  type: 'sine' | 'square' | 'triangle' = 'sine',
): void {
  const audio = context();
  if (!audio) return;

  try {
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audio.currentTime);
    gain.gain.setValueAtTime(0.1, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audio.currentTime + duration);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  } catch {
    /* audio is never worth breaking a flow over */
  }
}

/**
 * The arriving-message notification tone.
 *
 * Two ascending notes, deliberately short. Distinct from `triggerBeep` so a
 * notification cannot be confused with UI feedback in a noisy environment.
 */
export function playNotificationSound(): void {
  const audio = context();
  if (!audio) return;

  try {
    [660, 880].forEach((freq, index) => {
      const start = audio.currentTime + index * 0.09;
      const osc = audio.createOscillator();
      const gain = audio.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.09, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);

      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  } catch {
    /* ignore */
  }
}

/**
 * A spoken placeholder for a voice note whose audio is not available.
 *
 * Two short vocal sweeps stand in for a human cadence, then the browser's own
 * speech synthesiser announces who the note is from. This is a fallback for
 * messages that genuinely have no playable media — real recordings are played
 * normally and never reach this function.
 */
export function playSynthesizedVoiceNote(senderName: string, durationSec: number): void {
  const audio = context();

  try {
    if (audio) {
      const sweep = (delay: number, duration: number, freq: number) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audio.currentTime + delay);
        osc.frequency.exponentialRampToValueAtTime(
          freq * 1.4,
          audio.currentTime + delay + duration,
        );

        gain.gain.setValueAtTime(0, audio.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.08, audio.currentTime + delay + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + delay + duration);

        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(audio.currentTime + delay);
        osc.stop(audio.currentTime + delay + duration);
      };

      for (let i = 0; i < durationSec; i++) {
        sweep(i * 1.0, 0.45, 180);
        sweep(i * 1.0 + 0.5, 0.4, 150);
      }
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`Voice note from ${senderName}`);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    console.warn('[audio] synthesised voice note failed:', err);
  }
}

/** Stop any in-progress speech. */
export function stopSpeech(): void {
  try {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
