export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  unlock(): void {
    this.ensure();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 0.22 : 0;
  }

  shoot(): void {
    this.tone(880, 0.045, 'square', 0.045, 220);
  }

  hit(): void {
    this.tone(220, 0.07, 'sawtooth', 0.05, 90);
  }

  explode(): void {
    this.noise(0.22, 0.12);
    this.tone(120, 0.18, 'triangle', 0.07, 40);
  }

  pickup(): void {
    this.tone(660, 0.08, 'sine', 0.06, 990);
    window.setTimeout(() => this.tone(990, 0.1, 'sine', 0.05, 1320), 70);
  }

  hurt(): void {
    this.tone(180, 0.16, 'sawtooth', 0.07, 70);
  }

  dash(): void {
    this.tone(320, 0.1, 'triangle', 0.05, 720);
  }

  wave(): void {
    this.tone(392, 0.14, 'sine', 0.06, 523);
    window.setTimeout(() => this.tone(523, 0.18, 'sine', 0.06, 659), 120);
  }

  gameOver(): void {
    this.tone(220, 0.25, 'sawtooth', 0.07, 80);
    window.setTimeout(() => this.tone(160, 0.35, 'triangle', 0.06, 55), 180);
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFreq = freq,
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  private noise(duration: number, volume: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
    }
  }
}
