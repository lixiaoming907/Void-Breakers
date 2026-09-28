import * as THREE from 'three';

type Particle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
  gravity: number;
};

type Shock = {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  maxScale: number;
  active: boolean;
};

const MAX_PARTICLES = 280;
const MAX_SHOCKS = 24;

/**
 * Pooled burst / shockwave VFX — free-list instead of O(n) find() each spawn.
 */
export class Effects {
  readonly group = new THREE.Group();
  private readonly particles: Particle[] = [];
  private readonly particleFree: Particle[] = [];
  private readonly geometry = new THREE.SphereGeometry(0.09, 6, 6);
  private readonly material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  private readonly shockwaves: Shock[] = [];
  private readonly shockFree: Shock[] = [];
  private readonly shockGeometry = new THREE.RingGeometry(0.4, 0.55, 28);
  private readonly shockMaterial = new THREE.MeshBasicMaterial({
    color: '#7df9ff',
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mesh = new THREE.Mesh(this.geometry, this.material.clone());
      mesh.visible = false;
      this.group.add(mesh);
      const p: Particle = {
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        active: false,
        gravity: 0,
      };
      this.particles.push(p);
      this.particleFree.push(p);
    }
    for (let i = 0; i < MAX_SHOCKS; i++) {
      const mesh = new THREE.Mesh(this.shockGeometry, this.shockMaterial.clone());
      mesh.visible = false;
      mesh.rotation.x = -Math.PI / 2;
      this.group.add(mesh);
      const w: Shock = {
        mesh,
        life: 0,
        maxLife: 0.45,
        maxScale: 3,
        active: false,
      };
      this.shockwaves.push(w);
      this.shockFree.push(w);
    }
  }

  private takeParticle(): Particle | null {
    return this.particleFree.pop() ?? null;
  }

  private releaseParticle(p: Particle): void {
    if (!p.active) return;
    p.active = false;
    p.mesh.visible = false;
    this.particleFree.push(p);
  }

  private takeShock(): Shock | null {
    return this.shockFree.pop() ?? null;
  }

  private releaseShock(w: Shock): void {
    if (!w.active) return;
    w.active = false;
    w.mesh.visible = false;
    this.shockFree.push(w);
  }

  burst(position: THREE.Vector3, color: string, count = 12, speed = 6, size = 1): void {
    const n = Math.min(count, 18);
    for (let i = 0; i < n; i++) {
      const particle = this.takeParticle();
      if (!particle) return;
      particle.active = true;
      particle.maxLife = 0.35 + Math.random() * 0.4;
      particle.life = particle.maxLife;
      particle.gravity = -2.2;
      particle.mesh.visible = true;
      particle.mesh.position.copy(position);
      (particle.mesh.material as THREE.MeshBasicMaterial).color.set(color);
      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
      particle.mesh.scale.setScalar(size * (0.6 + Math.random() * 0.85));
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const s = speed * (0.45 + Math.random() * 0.85);
      particle.velocity.set(
        Math.sin(phi) * Math.cos(theta) * s,
        Math.abs(Math.cos(phi)) * s * 0.55 + 1.2,
        Math.sin(phi) * Math.sin(theta) * s,
      );
    }
  }

  explosion(position: THREE.Vector3, color: string, scale = 1): void {
    this.burst(position, color, Math.min(16, 12 + Math.floor(scale * 6)), 7 * scale, 1.1 * scale);
    this.burst(position, '#ffffff', 5, 4.5 * scale, 0.7);
    this.shockwave(position, color, 3.0 * scale, 0.45);
  }

  shockwave(position: THREE.Vector3, color: string, maxScale = 3, life = 0.45): void {
    const wave = this.takeShock();
    if (!wave) return;
    wave.active = true;
    wave.life = life;
    wave.maxLife = life;
    wave.maxScale = maxScale;
    wave.mesh.visible = true;
    wave.mesh.position.copy(position);
    wave.mesh.position.y = 0.12;
    (wave.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    (wave.mesh.material as THREE.MeshBasicMaterial).opacity = 0.75;
    wave.mesh.scale.setScalar(0.3);
  }

  update(delta: number): void {
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.life -= delta;
      if (particle.life <= 0) {
        this.releaseParticle(particle);
        continue;
      }
      particle.velocity.y += particle.gravity * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      const t = particle.life / particle.maxLife;
      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = t * 0.95;
      particle.mesh.scale.multiplyScalar(1 - delta * 0.8);
    }

    for (const wave of this.shockwaves) {
      if (!wave.active) continue;
      wave.life -= delta;
      if (wave.life <= 0) {
        this.releaseShock(wave);
        continue;
      }
      const t = 1 - wave.life / wave.maxLife;
      wave.mesh.scale.setScalar(0.3 + t * wave.maxScale);
      (wave.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.7;
    }
  }

  clear(): void {
    for (const particle of this.particles) {
      if (particle.active) this.releaseParticle(particle);
    }
    for (const wave of this.shockwaves) {
      if (wave.active) this.releaseShock(wave);
    }
  }

  dispose(): void {
    this.clear();
    this.geometry.dispose();
    this.shockGeometry.dispose();
    this.material.dispose();
    this.shockMaterial.dispose();
    for (const particle of this.particles) {
      (particle.mesh.material as THREE.Material).dispose();
    }
    for (const wave of this.shockwaves) {
      (wave.mesh.material as THREE.Material).dispose();
    }
  }
}
