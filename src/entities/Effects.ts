import * as THREE from 'three';

type Particle = {
  index: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  gravity: number;
  scale: number;
  active: boolean;
};

type Shock = {
  index: number;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxScale: number;
  active: boolean;
};

const MAX_PARTICLES = 480;
const MAX_SHOCKS = 48;

/**
 * Particles: one THREE.Points draw call with per-particle size/color/alpha.
 * Shockwaves: pooled rings, materials shared per color (no per-particle clone).
 */
export class Effects {
  readonly group = new THREE.Group();

  private readonly particles: Particle[] = [];
  private readonly particleFree: number[] = [];
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly sizes: Float32Array;
  private readonly alphas: Float32Array;
  private readonly pointsGeo: THREE.BufferGeometry;
  private readonly pointsMat: THREE.ShaderMaterial;
  private readonly points: THREE.Points;

  private readonly shockwaves: Shock[] = [];
  private readonly shockFree: number[] = [];
  private readonly shockGeometry = new THREE.RingGeometry(0.4, 0.55, 28);

  constructor() {
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);
    this.alphas = new Float32Array(MAX_PARTICLES);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        index: i,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        gravity: 0,
        scale: 1,
        active: false,
      });
      this.particleFree.push(i);
      this.sizes[i] = 0;
      this.alphas[i] = 0;
    }

    this.pointsGeo = new THREE.BufferGeometry();
    this.pointsGeo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.pointsGeo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.pointsGeo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.pointsGeo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));

    this.pointsMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (180.0 / max(1.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          float soft = smoothstep(0.5, 0.12, d);
          gl_FragColor = vec4(vColor * 0.72, vAlpha * soft * 0.55);
        }
      `,
      vertexColors: true,
    });

    this.points = new THREE.Points(this.pointsGeo, this.pointsMat);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    for (let i = 0; i < MAX_SHOCKS; i++) {
      // one material per slot so overlapping waves can fade independently
      const material = new THREE.MeshBasicMaterial({
        color: '#7df9ff',
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.shockGeometry, material);
      mesh.visible = false;
      mesh.rotation.x = -Math.PI / 2;
      this.group.add(mesh);
      this.shockwaves.push({
        index: i,
        mesh,
        material,
        life: 0,
        maxLife: 0.45,
        maxScale: 3,
        active: false,
      });
      this.shockFree.push(i);
    }
  }

  private takeParticle(): Particle | null {
    const idx = this.particleFree.pop();
    if (idx === undefined) return null;
    return this.particles[idx];
  }

  private releaseParticle(p: Particle): void {
    if (!p.active) return;
    p.active = false;
    this.alphas[p.index] = 0;
    this.sizes[p.index] = 0;
    this.particleFree.push(p.index);
  }

  private takeShock(): Shock | null {
    const idx = this.shockFree.pop();
    if (idx === undefined) return null;
    return this.shockwaves[idx];
  }

  private releaseShock(w: Shock): void {
    if (!w.active) return;
    w.active = false;
    w.mesh.visible = false;
    this.shockFree.push(w.index);
  }

  burst(position: THREE.Vector3, color: string, count = 12, speed = 6, size = 1): void {
    const c = _color.set(color);
    const n = Math.min(count, 18);
    for (let i = 0; i < n; i++) {
      const particle = this.takeParticle();
      if (!particle) return;
      const idx = particle.index;
      particle.active = true;
      particle.maxLife = 0.35 + Math.random() * 0.4;
      particle.life = particle.maxLife;
      particle.gravity = -2.2;
      particle.scale = size * (0.6 + Math.random() * 0.85);
      this.positions[idx * 3] = position.x;
      this.positions[idx * 3 + 1] = position.y;
      this.positions[idx * 3 + 2] = position.z;
      this.colors[idx * 3] = c.r;
      this.colors[idx * 3 + 1] = c.g;
      this.colors[idx * 3 + 2] = c.b;
      this.alphas[idx] = 0.95;
      this.sizes[idx] = particle.scale * 18;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const s = speed * (0.45 + Math.random() * 0.85);
      particle.vx = Math.sin(phi) * Math.cos(theta) * s;
      particle.vy = Math.abs(Math.cos(phi)) * s * 0.55 + 1.2;
      particle.vz = Math.sin(phi) * Math.sin(theta) * s;
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
    wave.mesh.position.set(position.x, 0.12, position.z);
    wave.material.color.set(color);
    wave.material.opacity = 0.75;
    wave.mesh.scale.setScalar(0.3);
  }

  update(delta: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      if (!particle.active) continue;
      particle.life -= delta;
      const idx = particle.index;
      if (particle.life <= 0) {
        this.releaseParticle(particle);
        continue;
      }
      particle.vy += particle.gravity * delta;
      this.positions[idx * 3] += particle.vx * delta;
      this.positions[idx * 3 + 1] += particle.vy * delta;
      this.positions[idx * 3 + 2] += particle.vz * delta;
      const t = particle.life / particle.maxLife;
      this.alphas[idx] = t * 0.95;
      particle.scale *= 1 - delta * 0.8;
      this.sizes[idx] = particle.scale * 18;
    }

    this.pointsGeo.attributes.position.needsUpdate = true;
    this.pointsGeo.attributes.color.needsUpdate = true;
    this.pointsGeo.attributes.aSize.needsUpdate = true;
    this.pointsGeo.attributes.aAlpha.needsUpdate = true;

    for (const wave of this.shockwaves) {
      if (!wave.active) continue;
      wave.life -= delta;
      if (wave.life <= 0) {
        this.releaseShock(wave);
        continue;
      }
      const t = 1 - wave.life / wave.maxLife;
      wave.mesh.scale.setScalar(0.3 + t * wave.maxScale);
      wave.material.opacity = (1 - t) * 0.7;
    }
  }

  clear(): void {
    for (const particle of this.particles) {
      if (particle.active) this.releaseParticle(particle);
    }
    for (const wave of this.shockwaves) {
      if (wave.active) this.releaseShock(wave);
    }
    this.pointsGeo.attributes.position.needsUpdate = true;
    this.pointsGeo.attributes.aAlpha.needsUpdate = true;
    this.pointsGeo.attributes.aSize.needsUpdate = true;
  }

  dispose(): void {
    this.clear();
    this.pointsGeo.dispose();
    this.pointsMat.dispose();
    this.shockGeometry.dispose();
    for (const wave of this.shockwaves) {
      wave.material.dispose();
    }
  }
}

const _color = new THREE.Color();
