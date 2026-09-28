import * as THREE from 'three';
import type { WeaponId } from '../game/Upgrades';

export type BulletKind = 'player' | 'enemy' | 'player-frag' | 'player-plasma';

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
  split: boolean;
  radius: number;
  crit: boolean;
  splitCount: number;
  splitDamage: number;
  spawnGrace: number;
  bounces: number;
};

const MAX_BULLETS = 520;

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
  // weapon-specific modifiers (persist across weapon swaps)
  weaponMultishot: number;
  weaponDamageMult: number;
  weaponRateHint: number;
  weaponPierce: number;
  weaponExtra: number;
  weaponTurn: number;
  weaponLife: number;
};

export class BulletPool {
  readonly group = new THREE.Group();
  private readonly bullets: Bullet[] = [];
  private readonly geoBolt = new THREE.SphereGeometry(0.12, 8, 8);
  private readonly geoMissile = new THREE.CapsuleGeometry(0.1, 0.35, 4, 8);
  private readonly geoPlasma = new THREE.IcosahedronGeometry(0.28, 1);
  private readonly geoLaser = new THREE.BoxGeometry(0.08, 0.08, 0.7);
  private readonly geoFrag = new THREE.TetrahedronGeometry(0.1, 0);

  private readonly matPlayer = new THREE.MeshBasicMaterial({ color: '#7df9ff' });
  private readonly matCrit = new THREE.MeshBasicMaterial({ color: '#fee440' });
  private readonly matEnemy = new THREE.MeshBasicMaterial({ color: '#ff6b9d' });
  private readonly matMissile = new THREE.MeshBasicMaterial({ color: '#f15bb5' });
  private readonly matPlasma = new THREE.MeshBasicMaterial({ color: '#00f5d4' });
  private readonly matLaser = new THREE.MeshBasicMaterial({ color: '#9ef9ff' });
  private readonly matFrag = new THREE.MeshBasicMaterial({ color: '#c77dff' });
  private readonly glowGeo = new THREE.SphereGeometry(0.22, 8, 8);
  private readonly glowPlayer = new THREE.MeshBasicMaterial({
    color: '#00c8e0',
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  private readonly glowEnemy = new THREE.MeshBasicMaterial({
    color: '#ff4d6d',
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly glowPlasma = new THREE.MeshBasicMaterial({
    color: '#00f5d4',
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  constructor() {
    for (let i = 0; i < MAX_BULLETS; i++) {
      const mesh = new THREE.Mesh(this.geoBolt, this.matPlayer);
      mesh.visible = false;
      const glow = new THREE.Mesh(this.glowGeo, this.glowPlayer);
      glow.visible = false;
      mesh.add(glow);
      this.group.add(mesh);
      this.bullets.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        damage: 0,
        kind: 'player',
        active: false,
        pierce: 0,
        homing: 0,
        explosive: false,
        split: false,
        radius: 0.18,
        crit: false,
        splitCount: 5,
        splitDamage: 0.45,
        spawnGrace: 0,
        bounces: 0,
      });
    }
  }

  firePlayer(req: FireRequest): void {
    let dir = req.direction.clone();
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    else right.normalize();
    const shots = 1 + req.multishot + req.weaponMultishot;
    const dmgMul = req.damage * req.weaponDamageMult;

    switch (req.weapon) {
      case 'scatter': {
        const pelletCount = 5 + req.multishot + req.weaponExtra;
        const spread = 0.32;
        for (let i = 0; i < pelletCount; i++) {
          const t = pelletCount <= 1 ? 0 : (i / (pelletCount - 1)) * 2 - 1;
          const d = dir
            .clone()
            .addScaledVector(right, t * spread)
            .normalize();
          this.spawn('player', req.origin, d, dmgMul * 0.42, req.speed * 1.1, 0.95, {
            pierce: req.pierce + req.weaponPierce,
            radius: 0.13,
            crit: req.crit,
          });
        }
        break;
      }
      case 'homing': {
        for (let i = 0; i < shots; i++) {
          const offset = (i - (shots - 1) / 2) * 0.28;
          const d = dir.clone().addScaledVector(right, offset).normalize();
          this.spawn('player', req.origin, d, dmgMul * 1.25, req.speed * 0.52, 3.4 * req.weaponLife, {
            pierce: 0,
            homing: 3.8 * req.weaponTurn,
            radius: 0.18,
            explosive: req.explosive,
            crit: req.crit,
          });
        }
        break;
      }
      case 'plasma': {
        this.spawn('player-plasma', req.origin, dir, dmgMul * 2.0, req.speed * 0.52, 2.5 * req.weaponLife, {
          pierce: 0,
          explosive: true,
          radius: 0.32 * req.weaponTurn,
          crit: req.crit,
        });
        if (req.multishot + req.weaponExtra > 0) {
          const extras = req.multishot + req.weaponExtra;
          for (let i = 0; i < extras; i++) {
            const d = dir
              .clone()
              .addScaledVector(right, (i % 2 === 0 ? 1 : -1) * 0.16 * (i + 1))
              .normalize();
            this.spawn('player-plasma', req.origin, d, dmgMul * 1.05, req.speed * 0.48, 2.2, {
              explosive: true,
              radius: 0.26 * req.weaponTurn,
              crit: req.crit,
            });
          }
        }
        break;
      }
      case 'railgun': {
        // multishot (global + weapon) always applies after weapon swap
        for (let i = 0; i < shots; i++) {
          const offset = (i - (shots - 1) / 2) * 0.12;
          const d = dir.clone().addScaledVector(right, offset).normalize();
          this.spawn('player', req.origin, d, dmgMul * 2.8, req.speed * 1.5, 1.05, {
            pierce: req.pierce + 3 + req.weaponPierce,
            radius: 0.16,
            crit: req.crit,
          });
        }
        break;
      }
      case 'flak': {
        for (let i = 0; i < 2 + req.multishot + Math.floor(req.weaponExtra / 2); i++) {
          const t = i === 0 ? 0 : (i % 2 === 0 ? 1 : -1) * 0.16 * Math.ceil(i / 2);
          const d = dir.clone().addScaledVector(right, t).normalize();
          this.spawn('player-frag', req.origin, d, dmgMul * 0.7, req.speed * 0.9, 1.35 * req.weaponLife, {
            pierce: req.pierce,
            split: true,
            explosive: req.explosive,
            radius: 0.15,
            crit: req.crit,
            splitCount: 5 + req.weaponExtra,
            splitDamage: 0.45 * req.weaponDamageMult,
          });
        }
        break;
      }
      case 'lance': {
        // wide piercing beam
        const width = req.weaponTurn; // reused as width factor
        for (let i = 0; i < Math.max(1, shots); i++) {
          const offset = (i - (Math.max(1, shots) - 1) / 2) * 0.1;
          const d = dir.clone().addScaledVector(right, offset).normalize();
          this.spawn('player', req.origin, d, dmgMul * 3.1, req.speed * 1.7, 0.85, {
            pierce: req.pierce + 6 + req.weaponPierce,
            radius: 0.22 * width,
            crit: req.crit,
          });
        }
        break;
      }
      case 'ricochet': {
        for (let i = 0; i < shots; i++) {
          const offset = (i - (shots - 1) / 2) * 0.12;
          const d = dir.clone().addScaledVector(right, offset).normalize();
          this.spawn('player', req.origin, d, dmgMul * 1.15, req.speed * req.weaponLife, 1.8, {
            pierce: 0,
            radius: 0.16,
            crit: req.crit,
            bounces: req.weaponExtra + 1,
          });
        }
        break;
      }
      case 'swarm': {
        const darts = 4 + req.multishot + req.weaponExtra;
        for (let i = 0; i < darts; i++) {
          const t = darts <= 1 ? 0 : (i / (darts - 1)) * 2 - 1;
          const d = dir
            .clone()
            .addScaledVector(right, t * 0.55)
            .normalize();
          this.spawn('player', req.origin, d, dmgMul * 0.55, req.speed * 0.55, 2.8, {
            pierce: 0,
            homing: 3.2 * req.weaponTurn,
            radius: 0.12,
            crit: req.crit,
          });
        }
        break;
      }
      case 'pulse':
      default: {
        for (let i = 0; i < shots; i++) {
          const offset = (i - (shots - 1) / 2) * 0.14;
          const d = dir.clone().addScaledVector(right, offset).normalize();
          this.spawn('player', req.origin, d, dmgMul, req.speed, 1.35, {
            pierce: req.pierce,
            explosive: req.explosive,
            radius: 0.14,
            crit: req.crit,
          });
        }
        break;
      }
    }
    void req.weaponRateHint;
  }

  private recycleOldest(): Bullet | null {
    let oldest: Bullet | null = null;
    for (const b of this.bullets) {
      if (!b.active) return b;
      if (!oldest || b.life < oldest.life) oldest = b;
    }
    if (oldest) {
      oldest.active = false;
      oldest.mesh.visible = false;
    }
    return oldest;
  }

  spawnEnemy(origin: THREE.Vector3, direction: THREE.Vector3, damage: number, speed: number): void {
    // long life so long-range shooters can actually reach across the large arena
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
      split?: boolean;
      radius?: number;
      crit?: boolean;
      splitCount?: number;
      splitDamage?: number;
      bounces?: number;
    } = {},
  ): void {
    const bullet = this.bullets.find((b) => !b.active) ?? this.recycleOldest();
    if (!bullet) return;
    bullet.active = true;
    bullet.kind = kind;
    bullet.damage = damage;
    bullet.life = life;
    bullet.pierce = opts.pierce ?? 0;
    bullet.homing = opts.homing ?? 0;
    bullet.explosive = opts.explosive ?? false;
    bullet.split = opts.split ?? false;
    bullet.radius = opts.radius ?? 0.18;
    bullet.crit = opts.crit ?? false;
    bullet.splitCount = opts.splitCount ?? 5;
    bullet.splitDamage = opts.splitDamage ?? 0.45;
    bullet.bounces = opts.bounces ?? 0;
    bullet.velocity.copy(direction);
    if (bullet.velocity.lengthSq() < 1e-8) bullet.velocity.set(0, 0, -1);
    bullet.velocity.normalize().multiplyScalar(speed);
    bullet.mesh.position.copy(origin);
    bullet.mesh.visible = true;
    // grace so bullets don't instantly collide with the firer's own hitbox / nearby husks
    bullet.spawnGrace = 0.06;

    const glow = bullet.mesh.children[0] as THREE.Mesh;

    if (kind === 'enemy') {
      bullet.mesh.geometry = this.geoBolt;
      bullet.mesh.material = this.matEnemy;
      glow.material = this.glowEnemy;
      glow.visible = true;
      bullet.mesh.scale.setScalar(1.15);
    } else if (kind === 'player-plasma') {
      bullet.mesh.geometry = this.geoPlasma;
      bullet.mesh.material = this.matPlasma;
      glow.material = this.glowPlasma;
      glow.visible = true;
      bullet.mesh.scale.setScalar(1.2);
    } else if (kind === 'player-frag') {
      bullet.mesh.geometry = this.geoFrag;
      bullet.mesh.material = this.matFrag;
      glow.visible = false;
      bullet.mesh.scale.setScalar(1);
    } else {
      // player pulse / rail / homing shells
      const isHoming = opts.homing && opts.homing > 0;
      if (isHoming) {
        bullet.mesh.geometry = this.geoMissile;
        bullet.mesh.material = this.matMissile;
      } else if ((opts.pierce ?? 0) >= 3) {
        bullet.mesh.geometry = this.geoLaser;
        bullet.mesh.material = this.matLaser;
        bullet.mesh.lookAt(origin.clone().add(direction));
      } else {
        bullet.mesh.geometry = this.geoBolt;
        bullet.mesh.material = bullet.crit ? this.matCrit : this.matPlayer;
      }
      glow.material = this.glowPlayer;
      glow.visible = true;
      bullet.mesh.scale.setScalar(bullet.crit ? 1.35 : 1);
    }

    if (isHomingLike(bullet)) {
      bullet.mesh.lookAt(origin.clone().add(direction));
    }
  }

  update(delta: number, enemyPositions: { x: number; z: number }[]): void {
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      bullet.life -= delta;
      if (bullet.spawnGrace > 0) bullet.spawnGrace = Math.max(0, bullet.spawnGrace - delta);
      if (bullet.life <= 0) {
        if (bullet.split) {
          this.splitFrag(bullet);
        } else {
          bullet.active = false;
          bullet.mesh.visible = false;
        }
        continue;
      }

      if (bullet.homing > 0 && enemyPositions.length > 0) {
        let best: { x: number; z: number } | null = null;
        let bestDist = 14;
        for (const t of enemyPositions) {
          const d = Math.hypot(t.x - bullet.mesh.position.x, t.z - bullet.mesh.position.z);
          if (d < bestDist) {
            bestDist = d;
            best = t;
          }
        }
        if (best) {
          const desired = new THREE.Vector3(
            best.x - bullet.mesh.position.x,
            0,
            best.z - bullet.mesh.position.z,
          ).normalize();
          const current = bullet.velocity.clone().normalize();
          current.lerp(desired, Math.min(1, delta * bullet.homing));
          const speed = bullet.velocity.length();
          bullet.velocity.copy(current.normalize().multiplyScalar(speed));
          bullet.mesh.lookAt(bullet.mesh.position.clone().add(bullet.velocity));
        }
      }

      bullet.mesh.position.addScaledVector(bullet.velocity, delta);
      bullet.mesh.rotation.x += delta * 6;
      bullet.mesh.rotation.y += delta * 4;

      // Keep in sync with ARENA (52x38) + margin. Old ±24/±20 culled outer-half shots.
      if (
        Math.abs(bullet.mesh.position.x) > 62 ||
        Math.abs(bullet.mesh.position.z) > 48 ||
        bullet.mesh.position.y < -2 ||
        bullet.mesh.position.y > 20
      ) {
        if (bullet.split) this.splitFrag(bullet);
        else {
          bullet.active = false;
          bullet.mesh.visible = false;
        }
      }
    }
  }

  private splitFrag(bullet: Bullet): void {
    bullet.active = false;
    bullet.mesh.visible = false;
    const origin = bullet.mesh.position.clone();
    const n = Math.max(3, bullet.splitCount);
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(angle), 0.12, Math.sin(angle)).normalize();
      this.spawn('player-frag', origin, dir, bullet.damage * bullet.splitDamage, 11, 0.55, {
        radius: 0.11,
        explosive: bullet.explosive,
        crit: bullet.crit,
      });
    }
  }

  consume(bullet: Bullet, allowSplit = true): void {
    if (!bullet.active) return;
    if (bullet.split && allowSplit) {
      this.splitFrag(bullet);
      return;
    }
    bullet.active = false;
    bullet.mesh.visible = false;
  }

  /** Ricochet: retarget a bullet toward a nearby enemy after a hit. */
  bounce(bullet: Bullet, target: { x: number; z: number }, speed: number): boolean {
    if (bullet.bounces <= 0) return false;
    bullet.bounces -= 1;
    bullet.pierce = Math.max(bullet.pierce, 0);
    const dir = new THREE.Vector3(target.x - bullet.mesh.position.x, 0, target.z - bullet.mesh.position.z);
    if (dir.lengthSq() < 1e-6) return false;
    dir.normalize();
    bullet.velocity.copy(dir).multiplyScalar(speed);
    bullet.life = Math.max(bullet.life, 1.2);
    bullet.spawnGrace = 0.03;
    bullet.mesh.lookAt(bullet.mesh.position.clone().add(dir));
    return true;
  }

  getActive(kind?: BulletKind): Bullet[] {
    return this.bullets.filter((b) => b.active && (!kind || b.kind === kind));
  }

  /** All player-side bullets including frags and plasma. */
  getPlayerBullets(): Bullet[] {
    return this.bullets.filter(
      (b) => b.active && (b.kind === 'player' || b.kind === 'player-frag' || b.kind === 'player-plasma'),
    );
  }

  clear(): void {
    for (const bullet of this.bullets) {
      bullet.active = false;
      bullet.mesh.visible = false;
    }
  }

  dispose(): void {
    this.geoBolt.dispose();
    this.geoMissile.dispose();
    this.geoPlasma.dispose();
    this.geoLaser.dispose();
    this.geoFrag.dispose();
    this.glowGeo.dispose();
    this.matPlayer.dispose();
    this.matCrit.dispose();
    this.matEnemy.dispose();
    this.matMissile.dispose();
    this.matPlasma.dispose();
    this.matLaser.dispose();
    this.matFrag.dispose();
    this.glowPlayer.dispose();
    this.glowEnemy.dispose();
    this.glowPlasma.dispose();
  }
}

function isHomingLike(bullet: Bullet): boolean {
  return bullet.homing > 0 || bullet.kind === 'player-plasma';
}
