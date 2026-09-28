import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Cyberpunk HDR-ish pipeline: ACES tonemap + bloom + output.
 * Bloom runs at half resolution — the blur is inherently low-frequency.
 */
export class PostFX {
  readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly renderPass: RenderPass;
  private lastWidth = 0;
  private lastHeight = 0;
  private lastDpr = 0;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(640, 360), 0.55, 0.42, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setSize(width: number, height: number, dpr: number): void {
    // skip redundant setSize — it reallocates render targets
    if (width === this.lastWidth && height === this.lastHeight && dpr === this.lastDpr) return;
    this.lastWidth = width;
    this.lastHeight = height;
    this.lastDpr = dpr;
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(width, height);
    // half-res bloom: cheaper blur chain, visually indistinguishable for neon glow
    this.bloom.setSize(Math.max(1, Math.floor(width * 0.5)), Math.max(1, Math.floor(height * 0.5)));
  }

  setBloom(strength: number, radius: number, threshold: number): void {
    this.bloom.strength = strength;
    this.bloom.radius = radius;
    this.bloom.threshold = threshold;
  }

  pulse(strength = 1.25): void {
    this.bloom.strength = strength;
  }

  update(delta: number): void {
    this.bloom.strength = THREE.MathUtils.damp(this.bloom.strength, 0.55, 2.5, delta);
  }

  render(): void {
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
  }
}
