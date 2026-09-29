import * as THREE from 'three';
import { ENEMIES } from '../game/constants';

const _toPlayer = new THREE.Vector3();
const _strafe = new THREE.Vector3();

export type EnemyKind =
  | 'drone'
  | 'striker'
  | 'tank'
  | 'boss'
  | 'swarm'
  | 'sniper'
  | 'splitter'
  | 'bomber';

export type Enemy = {
  group: THREE.Group;
  kind: EnemyKind;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  score: number;
  radius: number;
  fireCooldown: number;
  fireTimer: number;
  alive: boolean;
  hitFlash: number;
  orbitPhase: number;
  armed: boolean;
};

export type EnemyScale = { hp: number; damage: number };

/**
 * Distinct silhouettes + warm hazard palette. Visual groups are pooled per kind.
 */
export class EnemyManager {
  readonly group = new THREE.Group();
  readonly enemies: Enemy[] = [];
  private readonly freeGroups = new Map<EnemyKind, THREE.Group[]>();
  private readonly freeEnemies: Enemy[] = [];

  private readonly materials = {
    bodyHot: new THREE.MeshStandardMaterial({
      color: '#14060c',
      roughness: 0.4,
      metalness: 0.7,
      emissive: '#ff2244',
      emissiveIntensity: 1.15,
    }),
    bodyViolet: new THREE.MeshStandardMaterial({
      color: '#10051a',
      roughness: 0.35,
      metalness: 0.75,
      emissive: '#c44dff',
      emissiveIntensity: 1.05,
    }),
    bodyAmber: new THREE.MeshStandardMaterial({
      color: '#160a02',
      roughness: 0.5,
      metalness: 0.65,
      emissive: '#ff7a00',
      emissiveIntensity: 0.95,
    }),
    bodyBoss: new THREE.MeshStandardMaterial({
      color: '#021016',
      roughness: 0.28,
      metalness: 0.8,
      emissive: '#ff2e88',
      emissiveIntensity: 1.15,
    }),
    core: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    spike: new THREE.MeshStandardMaterial({
      color: '#0a0410',
      roughness: 0.3,
      metalness: 0.85,
      emissive: '#ff4d6d',
      emissiveIntensity: 1.35,
    }),
    ring: new THREE.MeshBasicMaterial({
      color: '#ff2e88',
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  };

  private readonly geometries = {
    drone: new THREE.OctahedronGeometry(0.3, 0),
    striker: new THREE.IcosahedronGeometry(0.34, 0),
    tank: new THREE.DodecahedronGeometry(0.5, 0),
    boss: new THREE.IcosahedronGeometry(0.78, 1),
    swarm: new THREE.TetrahedronGeometry(0.18, 0),
    sniper: new THREE.ConeGeometry(0.22, 0.55, 5),
    splitter: new THREE.DodecahedronGeometry(0.4, 0),
    bomber: new THREE.SphereGeometry(0.26, 8, 6),
    core: new THREE.SphereGeometry(0.1, 8, 8),
    spike: new THREE.ConeGeometry(0.06, 0.22, 5),
    ring: new THREE.RingGeometry(0.45, 0.58, 24),
    blade: new THREE.BoxGeometry(0.42, 0.04, 0.1),
  };

  private buildVisual(kind: EnemyKind): THREE.Group {
    const group = new THREE.Group();
    const mat =
      kind === 'striker' || kind === 'sniper'
        ? this.materials.bodyViolet
        : kind === 'tank' || kind === 'splitter'
          ? this.materials.bodyAmber
          : kind === 'boss'
            ? this.materials.bodyBoss
            : this.materials.bodyHot;

    const body = new THREE.Mesh(this.geometries[kind], mat);
    body.castShadow = true;
    const bodyY =
      kind === 'tank' || kind === 'splitter' ? 0.7 : kind === 'boss' ? 1.0 : kind === 'swarm' ? 0.35 : 0.55;
    body.position.y = bodyY;
    group.add(body);

    if (kind === 'drone' || kind === 'swarm') {
      const spikeCount = kind === 'swarm' ? 3 : 4;
      for (let i = 0; i < spikeCount; i++) {
        const spike = new THREE.Mesh(this.geometries.spike, this.materials.spike);
        const angle = (i / spikeCount) * Math.PI * 2;
        const r = kind === 'swarm' ? 0.22 : 0.42;
        spike.position.set(Math.cos(angle) * r, bodyY, Math.sin(angle) * r);
        spike.lookAt(spike.position.clone().multiplyScalar(2).setY(bodyY));
        spike.rotateX(Math.PI / 2);
        group.add(spike);
      }
    } else if (kind === 'sniper') {
      body.rotation.x = Math.PI;
      const barrel = new THREE.Mesh(this.geometries.blade, this.materials.spike);
      barrel.position.set(0, 0.7, -0.55);
      barrel.scale.set(0.35, 0.35, 1.8);
      group.add(barrel);
    } else if (kind === 'splitter') {
      const shell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.62, 0),
        new THREE.MeshBasicMaterial({
          color: '#ff9f1c',
          wireframe: true,
          transparent: true,
          opacity: 0.45,
        }),
      );
      shell.position.y = bodyY;
      group.add(shell);
    } else if (kind === 'bomber') {
      const fins = new THREE.Mesh(this.geometries.blade, this.materials.spike);
      fins.scale.set(1.4, 1, 0.4);
      fins.position.y = bodyY;
      group.add(fins);
      const fins2 = fins.clone();
      fins2.rotation.y = Math.PI / 2;
      group.add(fins2);
    } else if (kind === 'striker' || kind === 'tank' || kind === 'boss') {
      const spikeCount = kind === 'boss' ? 8 : kind === 'tank' ? 6 : 4;
      for (let i = 0; i < spikeCount; i++) {
        const spike = new THREE.Mesh(this.geometries.spike, this.materials.spike);
        const angle = (i / spikeCount) * Math.PI * 2;
        const r = kind === 'boss' ? 1.05 : kind === 'tank' ? 0.72 : 0.46;
        spike.position.set(Math.cos(angle) * r, bodyY, Math.sin(angle) * r);
        spike.lookAt(spike.position.clone().multiplyScalar(2).setY(bodyY));
        spike.rotateX(Math.PI / 2);
        group.add(spike);
      }
    }

    const core = new THREE.Mesh(this.geometries.core, this.materials.core);
    core.position.y = bodyY;
    core.scale.setScalar(kind === 'boss' ? 1.6 : 1);
    group.add(core);

    const ringScale = kind === 'boss' ? 1.8 : kind === 'tank' ? 1.2 : kind === 'swarm' ? 0.55 : 0.85;
    const ring = new THREE.Mesh(this.geometries.ring, this.materials.ring);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    ring.scale.setScalar(ringScale);
    group.add(ring);

    if (kind === 'boss') {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.35, 0.05, 6, 36),
        new THREE.MeshBasicMaterial({
          color: '#ff2e88',
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 1.15;
      group.add(halo);
    }

    return group;
  }

  private obtainGroup(kind: EnemyKind): THREE.Group {
    const list = this.freeGroups.get(kind);
    const reused = list?.pop();
    if (reused) {
      reused.visible = true;
      reused.position.set(0, 0, 0);
      reused.rotation.set(0, 0, 0);
      reused.scale.setScalar(1);
      return reused;
    }
    return this.buildVisual(kind);
  }

  private releaseGroup(kind: EnemyKind, group: THREE.Group): void {
    group.visible = false;
    if (!this.freeGroups.has(kind)) this.freeGroups.set(kind, []);
    this.freeGroups.get(kind)!.push(group);
  }

  spawn(kind: EnemyKind, position: THREE.Vector3, scale: EnemyScale = { hp: 1, damage: 1 }): Enemy {
    const stats = ENEMIES[kind];
    const group = this.obtainGroup(kind);
    group.position.copy(position);
    group.position.y = 0;
    this.group.add(group);

    const fireCooldown =
      kind === 'striker'
        ? ENEMIES.striker.fireCooldown
        : kind === 'boss'
          ? ENEMIES.boss.fireCooldown
          : kind === 'sniper'
            ? ENEMIES.sniper.fireCooldown
            : 0;

    let enemy = this.freeEnemies.pop();
    if (!enemy) {
      enemy = {
        group,
        kind,
        health: 1,
        maxHealth: 1,
        speed: 1,
        damage: 1,
        score: 1,
        radius: 1,
        fireCooldown: 0,
        fireTimer: 0,
        alive: true,
        hitFlash: 0,
        orbitPhase: 0,
        armed: true,
      };
    }

    enemy.group = group;
    enemy.kind = kind;
    enemy.health = stats.health * scale.hp;
    enemy.maxHealth = enemy.health;
    enemy.speed = stats.speed * (1 + Math.min(0.35, (scale.hp - 1) * 0.08));
    enemy.damage = stats.damage * scale.damage;
    enemy.score = stats.score;
    enemy.radius = stats.radius;
    enemy.fireCooldown = fireCooldown;
    enemy.fireTimer = fireCooldown * 0.5;
    enemy.alive = true;
    enemy.hitFlash = 0;
    enemy.orbitPhase = (position.x * 0.17 + position.z * 0.29) % (Math.PI * 2);
    enemy.armed = kind !== 'bomber';

    this.enemies.push(enemy);
    return enemy;
  }

  update(delta: number, elapsed: number, playerPos: THREE.Vector3): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
      enemy.group.rotation.y += delta * (enemy.kind === 'boss' ? 0.55 : enemy.kind === 'swarm' ? 2.2 : 1.35);

      const body = enemy.group.children[0] as THREE.Mesh | undefined;
      if (body) {
        const baseY =
          enemy.kind === 'tank' || enemy.kind === 'splitter'
            ? 0.7
            : enemy.kind === 'boss'
              ? 1.0
              : enemy.kind === 'swarm'
                ? 0.35
                : 0.55;
        body.position.y = baseY + Math.sin(elapsed * 2.8 + enemy.orbitPhase) * 0.06;
        // hitFlash was tracked but never drawn — scale pop so pierce hits are readable
        const hitPop = enemy.hitFlash > 0 ? 1 + enemy.hitFlash * 2.4 : 1;
        body.scale.setScalar(hitPop);
      }

      _toPlayer.subVectors(playerPos, enemy.group.position);
      _toPlayer.y = 0;
      const distance = _toPlayer.length();
      if (distance > 0.01) _toPlayer.normalize();

      if (enemy.kind === 'striker' || enemy.kind === 'boss') {
        const preferred = enemy.kind === 'boss' ? 8.5 : 7.2;
        const dir = distance > preferred + 1.2 ? 1 : distance < preferred - 1.2 ? -1 : 0;
        enemy.group.position.addScaledVector(_toPlayer, enemy.speed * dir * delta);
        _strafe.set(-_toPlayer.z, 0, _toPlayer.x);
        enemy.group.position.addScaledVector(
          _strafe,
          Math.sin(elapsed * 1.1 + enemy.orbitPhase) * enemy.speed * 0.55 * delta,
        );
      } else if (enemy.kind === 'sniper') {
        const preferred = 12;
        const dir = distance > preferred + 1 ? 1 : distance < preferred - 1 ? -1 : 0;
        enemy.group.position.addScaledVector(_toPlayer, enemy.speed * dir * delta);
        enemy.group.rotation.y = Math.atan2(_toPlayer.x, _toPlayer.z);
      } else {
        enemy.group.position.addScaledVector(_toPlayer, enemy.speed * delta);
      }

      enemy.group.position.x = THREE.MathUtils.clamp(enemy.group.position.x, -54, 54);
      enemy.group.position.z = THREE.MathUtils.clamp(enemy.group.position.z, -40, 40);
    }
  }

  damage(enemy: Enemy, amount: number): boolean {
    if (!enemy.alive) return false;
    enemy.health -= amount;
    enemy.hitFlash = 0.12;
    if (enemy.health <= 0) {
      enemy.alive = false;
      enemy.group.visible = false;
      return true;
    }
    return false;
  }

  removeDead(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.alive) {
        this.group.remove(enemy.group);
        this.releaseGroup(enemy.kind, enemy.group);
        this.enemies.splice(i, 1);
        this.freeEnemies.push(enemy);
      }
    }
  }

  clear(): void {
    for (const enemy of this.enemies) {
      this.group.remove(enemy.group);
      this.releaseGroup(enemy.kind, enemy.group);
      this.freeEnemies.push(enemy);
    }
    this.enemies.length = 0;
  }

  get aliveCount(): number {
    let n = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].alive) n += 1;
    }
    return n;
  }

  get poolStats(): { live: number; freeGroups: number; freeRecords: number } {
    let freeGroups = 0;
    this.freeGroups.forEach((list) => {
      freeGroups += list.length;
    });
    return { live: this.enemies.length, freeGroups, freeRecords: this.freeEnemies.length };
  }

  dispose(): void {
    this.clear();
    this.freeGroups.forEach((list) => {
      for (const g of list) {
        // shared geometries are disposed below; only unique one-off meshes need care
        this.group.remove(g);
      }
    });
    this.freeGroups.clear();
    this.freeEnemies.length = 0;
    Object.values(this.geometries).forEach((g) => g.dispose());
    Object.values(this.materials).forEach((m) => m.dispose());
  }
}
