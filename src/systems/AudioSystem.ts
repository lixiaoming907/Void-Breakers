export type SfxName =
  | 'shoot_scatter'
  | 'shoot_lance'
  | 'shoot_homing'
  | 'shoot_blackhole'
  | 'shoot_missile'
  | 'shoot_reflect'
  | 'hit'
  | 'hit_soft'
  | 'explode'
  | 'explode_big'
  | 'orbit'
  | 'secondary_missile'
  | 'nova'
  | 'turret'
  | 'pickup'
  | 'hurt'
  | 'dash'
  | 'wave'
  | 'gameover'
  | 'shield_break';

const FILES: Record<SfxName, string> = {
  shoot_scatter: 'audio/shoot_scatter.wav',
  shoot_lance: 'audio/shoot_lance.wav',
  shoot_homing: 'audio/shoot_homing.wav',
  shoot_blackhole: 'audio/shoot_blackhole.wav',
  shoot_missile: 'audio/shoot_missile.wav',
  shoot_reflect: 'audio/shoot_reflect.wav',
  hit: 'audio/hit.wav',
  hit_soft: 'audio/hit_soft.wav',
  explode: 'audio/explode.wav',
  explode_big: 'audio/explode_big.wav',
  orbit: 'audio/orbit.wav',
  secondary_missile: 'audio/secondary_missile.wav',
  nova: 'audio/nova.wav',
  turret: 'audio/turret.wav',
  pickup: 'audio/pickup.wav',
  hurt: 'audio/hurt.wav',
  dash: 'audio/dash.wav',
  wave: 'audio/wave.wav',
  gameover: 'audio/gameover.wav',
  shield_break: 'audio/shield_break.wav',
};

/**
 * File-based SFX (replaceable under public/audio/).
 * Falls back to short procedural tones if a file is missing (e.g. single-file HTML).
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private readonly buffers = new Map<string, AudioBuffer>();
  private loading = false;
  private lastPlay: Record<string, number> = {};

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
      void this.loadAll();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private async loadAll(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    const names = Object.keys(FILES) as SfxName[];
    await Promise.all(
      names.map(async (name) => {
        try {
          const res = await fetch(FILES[name]);
          if (!res.ok) return;
          const buf = await res.arrayBuffer();
          const ctx = this.ensure();
          if (!ctx) return;
          const audio = await ctx.decodeAudioData(buf);
          this.buffers.set(name, audio);
        } catch {
          /* keep procedural fallback */
        }
      }),
    );
    this.loading = false;
  }

  unlock(): void {
    this.ensure();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 0.22 : 0;
  }

  /** Play a named SFX; rate-limited to avoid stacking identical sounds. */
  play(name: SfxName, volume = 1): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const last = this.lastPlay[name] ?? 0;
    // min interval per cue
    const minGap = name.startsWith('shoot') ? 0.045 : name === 'hit' || name === 'hit_soft' ? 0.04 : 0.07;
    if (now - last < minGap) return;
    this.lastPlay[name] = now;

    const buffer = this.buffers.get(name);
    if (buffer) {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = volume * (name.startsWith('shoot') ? 0.55 : 0.85);
      src.buffer = buffer;
      src.connect(gain);
      gain.connect(this.master);
      src.start();
      return;
    }
    this.procedural(name);
  }

  // convenience wrappers used by game code
  shoot(kind: string = 'scatter'): void {
    const map: Record<string, SfxName> = {
      scatter: 'shoot_scatter',
      lance: 'shoot_lance',
      homing: 'shoot_homing',
      blackhole: 'shoot_blackhole',
      missile: 'shoot_missile',
      reflect: 'shoot_reflect',
    };
    this.play(map[kind] ?? 'shoot_scatter');
  }

  hit(): void {
    this.play('hit', 0.7);
  }

  hitSoft(): void {
    this.play('hit_soft', 0.45);
  }

  explode(big = false): void {
    this.play(big ? 'explode_big' : 'explode', big ? 1 : 0.8);
  }

  pickup(): void {
    this.play('pickup');
  }

  hurt(): void {
    this.play('hurt');
  }

  dash(): void {
    this.play('dash');
  }

  wave(): void {
    this.play('wave');
  }

  gameOver(): void {
    this.play('gameover');
  }

  shieldBreak(): void {
    this.play('shield_break');
  }

  secondary(kind: 'orbit' | 'missile' | 'nova' | 'turret'): void {
    const map = {
      orbit: 'orbit' as const,
      missile: 'secondary_missile' as const,
      nova: 'nova' as const,
      turret: 'turret' as const,
    };
    this.play(map[kind], 0.55);
  }

  private procedural(name: SfxName): void {
    // tiny fallback so the game still has feedback if files are missing
    const table: Record<SfxName, [number, number, OscillatorType]> = {
      shoot_scatter: [520, 180, 'square'],
      shoot_lance: [1200, 2400, 'sine'],
      shoot_homing: [220, 480, 'triangle'],
      shoot_blackhole: [90, 40, 'sine'],
      shoot_missile: [300, 120, 'sawtooth'],
      shoot_reflect: [1400, 900, 'sine'],
      hit: [180, 60, 'triangle'],
      hit_soft: [400, 200, 'sine'],
      explode: [120, 40, 'triangle'],
      explode_big: [90, 30, 'triangle'],
      orbit: [600, 900, 'sine'],
      secondary_missile: [260, 520, 'sawtooth'],
      nova: [180, 40, 'sine'],
      turret: [700, 350, 'square'],
      pickup: [660, 990, 'sine'],
      hurt: [160, 70, 'sawtooth'],
      dash: [320, 720, 'triangle'],
      wave: [392, 523, 'sine'],
      gameover: [220, 80, 'sawtooth'],
      shield_break: [900, 200, 'sine'],
    };
    const [a, b, t] = table[name];
    this.tone(a, 0.08, t, 0.05, b);
    if (name === 'explode' || name === 'explode_big' || name === 'nova') {
      this.noise(0.18, 0.08);
    }
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
    const n = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
    }
  }
}
