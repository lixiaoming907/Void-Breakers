import * as THREE from 'three';
import type { WeaponId } from '../game/Upgrades';

export type BulletKind = 'player' | 'enemy' | 'player-frag' | 'player-plasma' | 'player-beam';

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
      // ── 散弹：短程扇形弹幕，无追踪 ──
      case 'scatter': {
        const pelletCount = 7 + req.multishot + req.weaponExtra;
        const spread = 0.38;
        for (let i = 0; i < pelletCount; i++) {
          const t = pelletCount <= 1 ? 0 : (i / (pelletCount - 1)) * 2 - 1;
          const d = dir
            .clone()
            .addScaledVector(right, t * spread)
            .addScaledVector(dir, (Math.random() - 0.5) * 0.08)
            .normalize();
          this.spawn('player', req.origin, d, dmgMul * 0.38, req.speed * 1.15, 0.72, {
            pierce: req.pierce + req.weaponPierce,
            radius: 0.12,
            crit: req.crit,
            visualScale: 0.75,
          });
        }
        break;
      }

      // ── 追踪飞弹：少而重的导弹，强锁定 ──
      case 'homing': {
        for (let i = 0; i < shots; i++) {
          const offset = (i - (shots - 1) / 2) * 0.35;
          const d = dir.clone().addScaledVector(right, offset).normalize();
          this.spawn('player', req.origin, d, dmgMul * 1.7, req.speed * 0.38, 4.2 * req.weaponLife, {
            pierce: 0,
            homing: 5.2 * req.weaponTurn,
            radius: 0.24,
            explosive: req.explosive,
            crit: req.crit,
            visualScale: 1.35,
            missile: true,
          });
        }
        break;
      }

      // ── 等离子：大能量球 + AOE ──
      case 'plasma': {
        this.spawn('player-plasma', req.origin, dir, dmgMul * 2.2, req.speed * 0.48, 2.6 * req.weaponLife, {
          pierce: 0,
          explosive: true,
          radius: 0.36 * req.weaponTurn,
          crit: req.crit,
          visualScale: 1.45,
        });
        if (req.multishot + req.weaponExtra > 0) {
          const extras = req.multishot + req.weaponExtra;
          for (let i = 0; i < extras; i++) {
            const d = dir
              .clone()
              .addScaledVector(right, (i % 2 === 0 ? 1 : -1) * 0.16 * (i + 1))
              .normalize();
            this.spawn('player-plasma', req.origin, d, dmgMul * 1.05, req.speed * 0.45, 2.2, {
              explosive: true,
              radius: 0.28 * req.weaponTurn,
              crit: req.crit,
              visualScale: 1.1,
            });
          }
        }
        break;
      }

      // ── 磁轨炮：粗动能穿甲弹（短粗弹体，有重量感）──
      case 'railgun': {
        for (let i = 0; i < shots; i++) {
          const offset = (i - (shots - 1) / 2) * 0.14;
          const d = dir.clone().addScaledVector(right, offset).normalize();
          this.spawn('player', req.origin, d, dmgMul * 3.0, req.speed * 1.15, 1.25, {
            pierce: req.pierce + 3 + req.weaponPierce,
            radius: 0.24,
            crit: req.crit,
            visualScale: 1.7,
            rail: true,
          });
        }
        break;
      }

      // ── 高射炮：弹丸命中/到时裂成碎片 ──
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

      // ── 光矛：长条激光束，直线扫穿，形态与磁轨弹完全不同 ──
      case 'lance': {
        const width = Math.max(0.6, req.weaponTurn);
        const beams = Math.max(1, Math.min(shots, 3));
        for (let i = 0; i < beams; i++) {
          const offset = (i - (beams - 1) / 2) * 0.22 * width;
          const d = dir.clone().addScaledVector(right, offset).normalize();
          this.spawn('player-beam', req.origin, d, dmgMul * 1.65, req.speed * 2.4, 0.42, {
            pierce: 40 + req.pierce + req.weaponPierce,
            radius: 0.42 * width,
            crit: req.crit,
            visualScale: 1,
            beamWidth: width,
          });
        }
        break;
      }

      // ── 弹射手枪：命中后弹向下一目标 ──
      case 'ricochet': {
        for (let i = 0; i < shots; i++) {
          const offset = (i - (shots - 1) / 2) * 0.12;
          const d = dir.clone().addScaledVector(right, offset).normalize();
          this.spawn('player', req.origin, d, dmgMul * 1.15, req.speed * req.weaponLife, 1.8, {
            pierce: 0,
            radius: 0.16,
            crit: req.crit,
            bounces: req.weaponExtra + 1,
            visualScale: 1.15,
          });
        }
        break;
      }

      // ── 蜂群：大量微小飞镖，轻微曲线制导（不是导弹）──
      case 'swarm': {
        const darts = 8 + req.multishot * 2 + req.weaponExtra;
        for (let i = 0; i < darts; i++) {
          const t = darts <= 1 ? 0 : (i / (darts - 1)) * 2 - 1;
          const lateral = t * 0.72;
          const d = dir
            .clone()
            .addScaledVector(right, lateral)
            .normalize();
          // spawn with a sideways component so flight curves
          const curveDir = d
            .clone()
            .addScaledVector(right, lateral * 0.45)
            .normalize();
          this.spawn('player', req.origin, curveDir, dmgMul * 0.32, req.speed * 0.78, 1.7, {
            pierce: 0,
            homing: 1.6 * req.weaponTurn,
            radius: 0.1,
            crit: req.crit,
            visualScale: 0.55,
            swarm: true,
          });
        }
        break;
      }

      // ── 脉冲：均衡连射小弹 ──
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
            visualScale: 1,
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
      visualScale?: number;
      rail?: boolean;
      missile?: boolean;
      swarm?: boolean;
      beamWidth?: number;
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
      bullet.mesh.scale.setScalar(opts.visualScale ?? 1);
    } else if (kind === 'player-beam') {
      // long laser strip — clearly not a rail slug
      bullet.mesh.geometry = this.geoLaser;
      bullet.mesh.material = this.matLaser;
      glow.material = this.glowPlayer;
      glow.visible = true;
      const w = opts.beamWidth ?? 1;
      bullet.mesh.scale.set(0.55 * w, 0.35, 14);
      bullet.mesh.lookAt(origin.clone().add(direction));
    } else {
      // player projectiles — visual identity per weapon
      const vs = opts.visualScale ?? 1;
      if (opts.missile) {
        bullet.mesh.geometry = this.geoMissile;
        bullet.mesh.material = this.matMissile;
        bullet.mesh.scale.setScalar(vs * 1.2);
      } else if (opts.rail) {
        // thick kinetic slug
        bullet.mesh.geometry = this.geoLaser;
        bullet.mesh.material = this.matLaser;
        bullet.mesh.scale.set(1.35 * vs, 1.35 * vs, 2.6 * vs);
        bullet.mesh.lookAt(origin.clone().add(direction));
      } else if (opts.swarm) {
        bullet.mesh.geometry = this.geoFrag;
        bullet.mesh.material = this.matFrag;
        bullet.mesh.scale.setScalar(vs);
        glow.visible = false;
      } else {
        bullet.mesh.geometry = this.geoBolt;
        bullet.mesh.material = bullet.crit ? this.matCrit : this.matPlayer;
        bullet.mesh.scale.setScalar(vs * (bullet.crit ? 1.35 : 1));
      }
      glow.material = opts.swarm ? this.glowPlasma : this.glowPlayer;
      if (!opts.swarm) glow.visible = true;
    }

    if (isHomingLike(bullet) || opts.missile || opts.rail || kind === 'player-beam') {
      bullet.mesh.lookAt(bullet.mesh.position.clone().add(bullet.velocity));
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
      (b) =>
        b.active &&
        (b.kind === 'player' ||
          b.kind === 'player-frag' ||
          b.kind === 'player-plasma' ||
          b.kind === 'player-beam'),
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
