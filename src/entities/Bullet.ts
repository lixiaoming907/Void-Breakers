import * as THREE from 'three';
import type { WeaponId } from '../game/Upgrades';

export type BulletKind =
  | 'player'
  | 'enemy'
  | 'player-reflect'
  | 'player-blackhole'
  | 'player-missile'
  | 'player-homing'
  | 'player-beam';

export type Bullet = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  damage: number;
  kind: BulletKind;
  active: boolean;
  pierce: number;
  homing: number;
  explosive: boolean;
  radius: number;
  crit: boolean;
  spawnGrace: number;
  bounces: number;
  /** blackhole gravity strength (0 = off) */
  gravity: number;
  /** blackhole / missile AOE radius */
  aoe: number;
  /** per-second contact damage (blackhole) */
  dps: number;
  /** missile boom damage */
  boomDamage: number;
};

const MAX_BULLETS = 520;

const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _desired = new THREE.Vector3();
const _current = new THREE.Vector3();
const _look = new THREE.Vector3();
const _bounceDir = new THREE.Vector3();

export type FireRequest = {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  damage: number;
  speed: number;
  weapon: WeaponId;
  multishot: number;
  pierce: number;
  explosive: boolean;
  crit: boolean;
  weaponMultishot: number;
  weaponDamageMult: number;
  weaponRateHint: number;
  weaponPierce: number;
  weaponExtra: number;
  weaponTurn: number;
  weaponLife: number;
};

/** Instant lance result: visual beam + damage line endpoints */
export type LanceShot = {
  from: THREE.Vector3;
  to: THREE.Vector3;
  width: number;
  damage: number;
  crit: boolean;
  maxDistance: number;
};

export class BulletPool {
  readonly group = new THREE.Group();
  private readonly bullets: Bullet[] = [];
  private readonly free: Bullet[] = [];
  private readonly geoBolt = new THREE.SphereGeometry(0.12, 8, 8);
  private readonly geoMissile = new THREE.CapsuleGeometry(0.11, 0.32, 4, 8);
  private readonly geoBlackhole = new THREE.SphereGeometry(0.55, 24, 18);
  private readonly geoLaser = new THREE.BoxGeometry(0.08, 0.08, 0.7);
  private readonly geoReflect = new THREE.BoxGeometry(0.06, 0.06, 0.55);
  private readonly geoHoming = new THREE.ConeGeometry(0.12, 0.4, 6);

  // palette-driven (edit src/game/palette.ts for these hexes via HDR if desired)
  private readonly matScatter = new THREE.MeshBasicMaterial({ color: '#7df9ff' });
  private readonly matCrit = new THREE.MeshBasicMaterial({ color: '#fee440' });
  private readonly matEnemy = new THREE.MeshBasicMaterial({ color: '#ff6b9d' });
  private readonly matHoming = new THREE.MeshBasicMaterial({ color: '#c77dff' });
  /** purple rim → black core */
  private readonly matBlackhole = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float fres = pow(1.0 - max(dot(normalize(vView), normalize(vNormal)), 0.0), 1.55);
        vec3 core = vec3(0.012, 0.0, 0.03);
        vec3 rim = vec3(0.706, 0.302, 1.0);
        gl_FragColor = vec4(mix(core, rim, fres * 0.98), 0.94);
      }
    `,
  });
  private readonly matMissile = new THREE.MeshBasicMaterial({ color: '#ff8c42' });
  private readonly matReflect = new THREE.MeshBasicMaterial({ color: '#2dff88' });
  private readonly matLance = new THREE.MeshBasicMaterial({
    color: '#4db8ff',
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private readonly glowGeo = new THREE.SphereGeometry(0.22, 8, 8);
  private readonly glowSoft = new THREE.MeshBasicMaterial({
    color: '#7df9ff',
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  private readonly glowEnemy = new THREE.MeshBasicMaterial({
    color: '#ff4d6d',
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  private readonly glowBlackhole = new THREE.MeshBasicMaterial({
    color: '#b44dff',
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  /** Instant lance beam visuals (no travel). */
  private readonly beamPool: THREE.Mesh[] = [];
  private readonly beamGeo = new THREE.BoxGeometry(1, 1, 1);

  private playerAlive = 0;

  constructor() {
    for (let i = 0; i < MAX_BULLETS; i++) {
      const mesh = new THREE.Mesh(this.geoBolt, this.matScatter);
      mesh.visible = false;
      const glow = new THREE.Mesh(this.glowGeo, this.glowSoft);
      glow.visible = false;
      mesh.add(glow);
      this.group.add(mesh);
      const bullet: Bullet = {
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        damage: 0,
        kind: 'player',
        active: false,
        pierce: 0,
        homing: 0,
        explosive: false,
        radius: 0.18,
        crit: false,
        spawnGrace: 0,
        bounces: 0,
        gravity: 0,
        aoe: 0,
        dps: 0,
        boomDamage: 0,
      };
      this.bullets.push(bullet);
      this.free.push(bullet);
    }
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(this.beamGeo, this.matLance.clone());
      mesh.visible = false;
      this.group.add(mesh);
      this.beamPool.push(mesh);
    }
  }

  get activePlayerCount(): number {
    return this.playerAlive;
  }

  forEachPlayerBullet(fn: (b: Bullet) => void): void {
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      if (!b.active) continue;
      if (
        b.kind === 'player' ||
        b.kind === 'player-reflect' ||
        b.kind === 'player-blackhole' ||
        b.kind === 'player-missile' ||
        b.kind === 'player-homing'
      ) {
        fn(b);
      }
    }
  }

  getPlayerBullets(): Bullet[] {
    const out: Bullet[] = [];
    this.forEachPlayerBullet((b) => out.push(b));
    return out;
  }

  getActive(kind?: BulletKind): Bullet[] {
    return this.bullets.filter((b) => b.active && (!kind || b.kind === kind));
  }

  /**
   * Fire primary weapon.
   * lance is handled separately via `spawnLanceBeam` + line damage in Game.
   */
  firePlayer(req: FireRequest): void {
    let dir = req.direction.clone();
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    const right = _right.copy(_up).cross(dir);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    else right.normalize();
    const shots = 1 + req.multishot + req.weaponMultishot;
    const dmgMul = req.damage * req.weaponDamageMult;

    switch (req.weapon) {
      case 'scatter': {
        // 量大
        const pelletCount = 7 + req.multishot * 2 + req.weaponExtra;
        const spread = 0.4;
        for (let i = 0; i < pelletCount; i++) {
          const t = pelletCount <= 1 ? 0 : (i / (pelletCount - 1)) * 2 - 1;
          const d = _dir
            .copy(dir)
            .addScaledVector(right, t * spread)
            .normalize();
          this.spawn('player', req.origin, d, dmgMul * 0.36, req.speed * 1.15, 0.7, {
            pierce: req.pierce + req.weaponPierce,
            radius: 0.11,
            crit: req.crit,
            visualScale: 0.7,
          });
        }
        break;
      }

      case 'homing': {
        // 慢速强追踪
        for (let i = 0; i < shots; i++) {
          const offset = (i - (shots - 1) / 2) * 0.32;
          const d = _dir.copy(dir).addScaledVector(right, offset).normalize();
          this.spawn('player-homing', req.origin, d, dmgMul * 1.55, req.speed * 0.32, 5.2, {
            pierce: 0,
            homing: 6.5 * req.weaponTurn,
            radius: 0.2,
            crit: req.crit,
            visualScale: 1.2,
          });
        }
        break;
      }

      case 'blackhole': {
        // large sphere, slow, persistent contact damage + gravity (Game)
        for (let i = 0; i < Math.max(1, Math.min(shots, 3)); i++) {
          const offset = (i - (Math.min(shots, 3) - 1) / 2) * 0.55;
          const d = _dir.copy(dir).addScaledVector(right, offset).normalize();
          this.spawn('player-blackhole', req.origin, d, 0, req.speed * 0.22, 6.5, {
            pierce: 0,
            radius: 1.35 * req.weaponTurn,
            crit: req.crit,
            visualScale: 1.0,
            gravity: 14 * req.weaponExtra,
            aoe: 2.2 * req.weaponTurn,
            dps: dmgMul * 3.2 * req.weaponLife,
          });
        }
        break;
      }

      case 'missile': {
        // 中等射速，命中/超时爆炸
        for (let i = 0; i < shots; i++) {
          const offset = (i - (shots - 1) / 2) * 0.28;
          const d = _dir.copy(dir).addScaledVector(right, offset).normalize();
          this.spawn('player-missile', req.origin, d, dmgMul * 1.1, req.speed * 0.55, 3.2, {
            pierce: 0,
            radius: 0.18,
            crit: req.crit,
            visualScale: 1.15,
            explosive: true,
            boomDamage: dmgMul * 1.8 * req.weaponExtra,
            aoe: 2.1 * req.weaponTurn,
          });
        }
        break;
      }

      case 'reflect': {
        // 亮绿短光线，命中弹跳
        for (let i = 0; i < shots; i++) {
          const offset = (i - (shots - 1) / 2) * 0.12;
          const d = _dir.copy(dir).addScaledVector(right, offset).normalize();
          this.spawn('player-reflect', req.origin, d, dmgMul * 1.05, req.speed * 1.35 * req.weaponLife, 1.6, {
            pierce: 0,
            radius: 0.14,
            crit: req.crit,
            visualScale: 1,
            bounces: req.weaponExtra,
          });
        }
        break;
      }

      case 'lance':
      default:
        // handled by Game (instant beam); fallback bolt if misrouted
        break;
    }
    void req.weaponRateHint;
  }

  /** Instant lance beam visual — long bright blue strip, fades fast. */
  spawnLanceBeam(origin: THREE.Vector3, direction: THREE.Vector3, width: number, distance = 42): void {
    const mesh = this.beamPool.find((m) => !m.visible) ?? this.beamPool[0];
    if (!mesh) return;
    const dir = direction.clone();
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    mesh.visible = true;
    mesh.position.copy(origin).addScaledVector(dir, distance * 0.5);
    mesh.position.y = 0.55;
    mesh.scale.set(0.06 * width, 0.09, distance);
    mesh.lookAt(mesh.position.clone().add(dir));
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.95;
    // hide after short flash via life in update
    mesh.userData.life = 0.12;
    mesh.userData.fading = true;
  }

  spawnEnemy(origin: THREE.Vector3, direction: THREE.Vector3, damage: number, speed: number): void {
    this.spawn('enemy', origin, direction, damage, speed, 6.5, { radius: 0.18 });
  }

  private spawn(
    kind: BulletKind,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    damage: number,
    speed: number,
    life: number,
    opts: {
      pierce?: number;
      homing?: number;
      explosive?: boolean;
      radius?: number;
      crit?: boolean;
      bounces?: number;
      visualScale?: number;
      gravity?: number;
      aoe?: number;
      dps?: number;
      boomDamage?: number;
    } = {},
  ): void {
    const bullet = this.free.pop();
    if (!bullet) return;
    bullet.active = true;
    bullet.kind = kind;
    bullet.damage = damage;
    bullet.life = life;
    bullet.pierce = opts.pierce ?? 0;
    bullet.homing = opts.homing ?? 0;
    bullet.explosive = opts.explosive ?? false;
    bullet.radius = opts.radius ?? 0.18;
    bullet.crit = opts.crit ?? false;
    bullet.bounces = opts.bounces ?? 0;
    bullet.gravity = opts.gravity ?? 0;
    bullet.aoe = opts.aoe ?? 0;
    bullet.dps = opts.dps ?? 0;
    bullet.boomDamage = opts.boomDamage ?? 0;
    bullet.velocity.copy(direction);
    if (bullet.velocity.lengthSq() < 1e-8) bullet.velocity.set(0, 0, -1);
    bullet.velocity.normalize().multiplyScalar(speed);
    bullet.mesh.position.copy(origin);
    bullet.mesh.visible = true;
    bullet.spawnGrace = 0.05;
    this.playerAlive += 1;

    const glow = bullet.mesh.children[0] as THREE.Mesh;
    const vs = opts.visualScale ?? 1;

    if (kind === 'enemy') {
      bullet.mesh.geometry = this.geoBolt;
      bullet.mesh.material = this.matEnemy;
      glow.material = this.glowEnemy;
      glow.visible = true;
      bullet.mesh.scale.setScalar(1.1);
    } else if (kind === 'player-blackhole') {
      bullet.mesh.geometry = this.geoBlackhole;
      bullet.mesh.material = this.matBlackhole;
      glow.material = this.glowBlackhole;
      glow.visible = true;
      bullet.mesh.scale.setScalar(1.55 * vs);
    } else if (kind === 'player-missile') {
      bullet.mesh.geometry = this.geoMissile;
      bullet.mesh.material = this.matMissile;
      glow.material = this.glowSoft;
      glow.visible = true;
      bullet.mesh.scale.setScalar(1.15 * vs);
    } else if (kind === 'player-homing') {
      bullet.mesh.geometry = this.geoHoming;
      bullet.mesh.material = this.matHoming;
      glow.material = this.glowSoft;
      glow.visible = true;
      bullet.mesh.scale.setScalar(1.1 * vs);
      bullet.mesh.lookAt(origin.clone().add(direction));
    } else if (kind === 'player-reflect') {
      bullet.mesh.geometry = this.geoReflect;
      bullet.mesh.material = this.matReflect;
      glow.material = this.glowSoft;
      glow.visible = true;
      bullet.mesh.scale.set(0.9 * vs, 0.9 * vs, 1.35 * vs);
      bullet.mesh.lookAt(origin.clone().add(direction));
    } else {
      bullet.mesh.geometry = this.geoBolt;
      bullet.mesh.material = bullet.crit ? this.matCrit : this.matScatter;
      glow.material = this.glowSoft;
      glow.visible = true;
      bullet.mesh.scale.setScalar(vs * (bullet.crit ? 1.3 : 1));
    }
  }

  private release(bullet: Bullet): void {
    if (!bullet.active) return;
    bullet.active = false;
    bullet.mesh.visible = false;
    this.playerAlive = Math.max(0, this.playerAlive - 1);
    this.free.push(bullet);
  }

  update(delta: number, enemyPositions: { x: number; z: number }[]): void {
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      bullet.life -= delta;
      if (bullet.spawnGrace > 0) bullet.spawnGrace = Math.max(0, bullet.spawnGrace - delta);
      if (bullet.life <= 0) {
        // missile / blackhole expire with effect
        if (bullet.kind === 'player-missile' && bullet.explosive) {
          this.release(bullet);
          // explosion handled by Game via kind check on death — also flag
          bullet.mesh.userData.justExpired = true;
          continue;
        }
        this.release(bullet);
        continue;
      }

      if (bullet.homing > 0 && enemyPositions.length > 0) {
        let best: { x: number; z: number } | null = null;
        let bestDist = 16;
        for (let i = 0; i < enemyPositions.length; i++) {
          const t = enemyPositions[i];
          const d = Math.hypot(t.x - bullet.mesh.position.x, t.z - bullet.mesh.position.z);
          if (d < bestDist) {
            bestDist = d;
            best = t;
          }
        }
        if (best) {
          _desired.set(best.x - bullet.mesh.position.x, 0, best.z - bullet.mesh.position.z).normalize();
          const speed = bullet.velocity.length();
          _current.copy(bullet.velocity).normalize();
          _current.lerp(_desired, Math.min(1, delta * bullet.homing));
          bullet.velocity.copy(_current.normalize().multiplyScalar(speed));
          _look.copy(bullet.mesh.position).add(bullet.velocity);
          bullet.mesh.lookAt(_look);
        }
      }

      // blackhole gravity is applied in Game against real enemy transforms
      if (bullet.gravity > 0) {
        bullet.mesh.rotation.y += delta * 2.8;
      }

      bullet.mesh.position.addScaledVector(bullet.velocity, delta);

      if (
        Math.abs(bullet.mesh.position.x) > 62 ||
        Math.abs(bullet.mesh.position.z) > 48 ||
        bullet.mesh.position.y < -2 ||
        bullet.mesh.position.y > 20
      ) {
        this.release(bullet);
      }
    }

    // fade lance beams
    for (const beam of this.beamPool) {
      if (!beam.visible) continue;
      const life = (beam.userData.life as number) - delta;
      beam.userData.life = life;
      const mat = beam.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, life / 0.12) * 0.95;
      if (life <= 0) beam.visible = false;
    }
  }

  consume(bullet: Bullet): void {
    this.release(bullet);
  }

  bounce(bullet: Bullet, target: { x: number; z: number }, speed: number): boolean {
    if (bullet.bounces <= 0) return false;
    bullet.bounces -= 1;
    _bounceDir.set(target.x - bullet.mesh.position.x, 0, target.z - bullet.mesh.position.z);
    if (_bounceDir.lengthSq() < 1e-6) return false;
    _bounceDir.normalize();
    bullet.velocity.copy(_bounceDir).multiplyScalar(speed);
    bullet.life = Math.max(bullet.life, 1.1);
    bullet.spawnGrace = 0.03;
    bullet.mesh.lookAt(bullet.mesh.position.clone().add(_bounceDir));
    return true;
  }

  clear(): void {
    for (const b of this.bullets) this.release(b);
    for (const beam of this.beamPool) beam.visible = false;
    this.playerAlive = 0;
  }

  dispose(): void {
    this.clear();
    this.geoBolt.dispose();
    this.geoMissile.dispose();
    this.geoBlackhole.dispose();
    this.geoLaser.dispose();
    this.geoReflect.dispose();
    this.geoHoming.dispose();
    this.glowGeo.dispose();
    this.beamGeo.dispose();
    this.matScatter.dispose();
    this.matCrit.dispose();
    this.matEnemy.dispose();
    this.matHoming.dispose();
    this.matBlackhole.dispose();
    this.matMissile.dispose();
    this.matReflect.dispose();
    this.matLance.dispose();
    this.glowSoft.dispose();
    this.glowEnemy.dispose();
    this.glowBlackhole.dispose();
    for (const beam of this.beamPool) {
      (beam.material as THREE.Material).dispose();
    }
  }
}
