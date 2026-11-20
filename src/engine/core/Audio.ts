/**
 * Lightweight procedural game audio using the Web Audio API.
 * No external audio assets or third-party dependencies are required.
 */
export class Audio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    // Browsers require audio to be started from a user gesture.
    // These one-shot listeners unlock the context on the first key or pointer input.
    window.addEventListener('pointerdown', () => this.unlock(), { once: true, passive: true });
    window.addEventListener('keydown', () => this.unlock(), { once: true });
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;

    if (this.context) return this.context;

    try {
      const context = new window.AudioContext();
      const masterGain = context.createGain();
      masterGain.gain.value = 0.32;
      masterGain.connect(context.destination);

      this.context = context;
      this.masterGain = masterGain;
      return context;
    } catch {
      // Audio is an enhancement: unsupported or blocked audio must not break gameplay.
      return null;
    }
  }

  /** Resume audio after the browser's first user gesture. */
  public unlock(): void {
    const context = this.ensureContext();
    if (!context || context.state === 'running') return;
    void context.resume().catch(() => undefined);
  }

  private getOutput(): { context: AudioContext; gain: GainNode } | null {
    const context = this.ensureContext();
    const gain = this.masterGain;
    if (!context || !gain) return null;

    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }

    return { context, gain };
  }

  /** Short square-wave impact with a fast downward pitch sweep. */
  public playHitSound(): void {
    const output = this.getOutput();
    if (!output) return;

    const { context, gain: master } = output;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.1);

    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.linearRampToValueAtTime(0.16, now + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
  }

  /** Ascending C-major arpeggio: C5, E5, G5, C6. */
  public playLevelUpSound(): void {
    const output = this.getOutput();
    if (!output) return;

    const { context, gain: master } = output;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const noteSpacing = 0.12;
    const noteDuration = 0.22;
    const now = context.currentTime;

    for (let i = 0; i < notes.length; i++) {
      const frequency = notes[i];
      if (frequency === undefined) continue;

      const startAt = now + i * noteSpacing;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);

      envelope.gain.setValueAtTime(0.0001, startAt);
      envelope.gain.linearRampToValueAtTime(0.13, startAt + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + noteDuration);

      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(startAt);
      oscillator.stop(startAt + noteDuration + 0.01);
    }
  }

  /** Short burst of generated white noise for damage and RAM abilities. */
  public playGlitchSound(): void {
    const output = this.getOutput();
    if (!output) return;

    const { context, gain: master } = output;
    const duration = 0.14;

    if (!this.noiseBuffer) {
      const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, frameCount, context.sampleRate);
      const channel = buffer.getChannelData(0);

      for (let i = 0; i < channel.length; i++) {
        channel[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }

    const now = context.currentTime;
    const source = context.createBufferSource();
    const envelope = context.createGain();

    source.buffer = this.noiseBuffer;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.linearRampToValueAtTime(0.12, now + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(envelope);
    envelope.connect(master);
    source.start(now);
    source.stop(now + duration + 0.01);
  }
}
