import * as THREE from 'three';

type Particle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
  gravity: number;
};

const MAX_PARTICLES = 320;

export class Effects {
  readonly group = new THREE.Group();
  private readonly particles: Particle[] = [];
  private readonly geometry = new THREE.SphereGeometry(0.09, 6, 6);
  private readonly material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  private readonly shockwaves: {
    mesh: THREE.Mesh;
    life: number;
    maxLife: number;
    maxScale: number;
    active: boolean;
  }[] = [];
  private readonly shockGeometry = new THREE.RingGeometry(0.4, 0.55, 32);
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
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        active: false,
        gravity: 0,
      });
    }
    for (let i = 0; i < 18; i++) {
      const mesh = new THREE.Mesh(this.shockGeometry, this.shockMaterial.clone());
      mesh.visible = false;
      mesh.rotation.x = -Math.PI / 2;
      this.group.add(mesh);
      this.shockwaves.push({
        mesh,
        life: 0,
        maxLife: 0.45,
        maxScale: 3,
        active: false,
      });
    }
  }

  burst(position: THREE.Vector3, color: string, count = 12, speed = 6, size = 1): void {
    for (let i = 0; i < count; i++) {
      const particle = this.particles.find((p) => !p.active);
      if (!particle) return;
      particle.active = true;
      particle.maxLife = 0.35 + Math.random() * 0.45;
      particle.life = particle.maxLife;
      particle.gravity = -2.2;
      particle.mesh.visible = true;
      particle.mesh.position.copy(position);
      (particle.mesh.material as THREE.MeshBasicMaterial).color.set(color);
      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
      particle.mesh.scale.setScalar(size * (0.6 + Math.random() * 0.9));
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
    this.burst(position, color, 22, 8 * scale, 1.3 * scale);
    this.burst(position, '#ffffff', 8, 5 * scale, 0.8);
    this.shockwave(position, color, 3.2 * scale, 0.5);
  }

  shockwave(position: THREE.Vector3, color: string, maxScale = 3, life = 0.45): void {
    const wave = this.shockwaves.find((w) => !w.active);
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
        particle.active = false;
        particle.mesh.visible = false;
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
        wave.active = false;
        wave.mesh.visible = false;
        continue;
      }
      const t = 1 - wave.life / wave.maxLife;
      const scale = 0.3 + t * wave.maxScale;
      wave.mesh.scale.setScalar(scale);
      (wave.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.7;
    }
  }

  clear(): void {
    for (const particle of this.particles) {
      particle.active = false;
      particle.mesh.visible = false;
    }
    for (const wave of this.shockwaves) {
      wave.active = false;
      wave.mesh.visible = false;
    }
  }

  dispose(): void {
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
