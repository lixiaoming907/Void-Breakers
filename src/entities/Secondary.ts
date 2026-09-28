import * as THREE from 'three';
import type { SecondaryId, SecondaryStats } from '../game/Upgrades';

export type SecondaryState = {
  id: SecondaryId;
  level: number;
  timer: number;
};

export type SecondaryEvents = {
  orbitHits: { x: number; z: number; damage: number }[];
  missiles: { x: number; z: number; damage: number; count: number } | null;
  novas: { x: number; z: number; damage: number; radius: number }[];
  turretShots: { x: number; z: number; damage: number; tx: number; tz: number }[];
};

/**
 * Secondary systems around the player: orbit blades, missile pod, nova, turret.
 */
export class SecondarySystem {
  readonly group = new THREE.Group();
  readonly owned = new Map<SecondaryId, SecondaryState>();
  private stats!: SecondaryStats;

  private readonly orbitMeshes: THREE.Mesh[] = [];
  private readonly orbitGeo = new THREE.TorusGeometry(0.22, 0.055, 6, 14);
  private readonly orbitMat = new THREE.MeshBasicMaterial({
    color: '#7df9ff',
    transparent: true,
    opacity: 0.8,
  });
  private readonly turretBody: THREE.Group;
  private readonly turretMat: THREE.MeshStandardMaterial;
  private angle = 0;
  private novaFlash = 0;
  private readonly novaRing: THREE.Mesh;
  private readonly novaMat: THREE.MeshBasicMaterial;

  constructor(stats: SecondaryStats) {
    this.stats = stats;

    this.turretMat = new THREE.MeshStandardMaterial({
      color: '#1a3048',
      emissive: '#1de0ff',
      emissiveIntensity: 0.75,
      roughness: 0.4,
      metalness: 0.6,
    });
    this.turretBody = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.12, 8), this.turretMat);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.4), this.turretMat);
    barrel.position.set(0, 0.1, -0.22);
    this.turretBody.add(base, barrel);
    this.turretBody.position.set(0.42, 0.28, 0.16);
    this.turretBody.visible = false;
    this.group.add(this.turretBody);

    this.novaMat = new THREE.MeshBasicMaterial({
      color: '#00f5d4',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.novaRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 36), this.novaMat);
    this.novaRing.rotation.x = -Math.PI / 2;
    this.novaRing.position.y = 0.1;
    this.novaRing.visible = false;
    this.group.add(this.novaRing);
  }

  setStats(stats: SecondaryStats): void {
    this.stats = stats;
    this.syncOrbitMeshes();
    this.turretBody.visible = this.owned.has('turret');
  }

  unlock(id: SecondaryId): void {
    const existing = this.owned.get(id);
    if (existing) existing.level += 1;
    else this.owned.set(id, { id, level: 1, timer: 0 });
    this.syncOrbitMeshes();
    this.turretBody.visible = this.owned.has('turret');
  }

  private syncOrbitMeshes(): void {
    const need = this.owned.has('orbit') ? this.stats.orbitCount : 0;
    while (this.orbitMeshes.length < need) {
      const mesh = new THREE.Mesh(this.orbitGeo, this.orbitMat);
      this.orbitMeshes.push(mesh);
      this.group.add(mesh);
    }
    while (this.orbitMeshes.length > need) {
      const mesh = this.orbitMeshes.pop()!;
      this.group.remove(mesh);
    }
  }

  update(
    delta: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    playerYaw: number,
    enemies: { x: number; z: number; radius: number }[],
  ): SecondaryEvents {
    const orbitHits: { x: number; z: number; damage: number }[] = [];
    const novas: { x: number; z: number; damage: number; radius: number }[] = [];
    const turretShots: { x: number; z: number; damage: number; tx: number; tz: number }[] = [];
    let missiles: SecondaryEvents['missiles'] = null;

    this.group.position.set(playerPos.x, 0, playerPos.z);

    if (this.owned.has('orbit') && this.orbitMeshes.length > 0) {
      this.angle += delta * this.stats.orbitSpin;
      const n = this.orbitMeshes.length;
      for (let i = 0; i < n; i++) {
        const a = this.angle + (i / n) * Math.PI * 2;
        const r = 1.05;
        const mesh = this.orbitMeshes[i];
        const wx = playerPos.x + Math.cos(a) * r;
        const wz = playerPos.z + Math.sin(a) * r;
        mesh.position.set(Math.cos(a) * r, 0.38 + Math.sin(elapsed * 3 + i) * 0.05, Math.sin(a) * r);
        mesh.rotation.x = Math.PI / 2;
        mesh.rotation.z = a;
        for (let ei = 0; ei < enemies.length; ei++) {
          const e = enemies[ei];
          const dx = wx - e.x;
          const dz = wz - e.z;
          const hitR = e.radius + 0.28;
          if (dx * dx + dz * dz <= hitR * hitR) {
            orbitHits.push({ x: e.x, z: e.z, damage: this.stats.orbitDamage * Math.min(delta * 12, 1.5) });
          }
        }
      }
    }

    const missileState = this.owned.get('missilePod');
    if (missileState) {
      missileState.timer += delta;
      if (missileState.timer >= this.stats.missileCd) {
        missileState.timer = 0;
        missiles = {
          x: playerPos.x,
          z: playerPos.z,
          damage: this.stats.missileDamage,
          count: this.stats.missileCount,
        };
      }
    }

    const novaState = this.owned.get('nova');
    if (novaState) {
      novaState.timer += delta;
      if (novaState.timer >= this.stats.novaCd) {
        novaState.timer = 0;
        novas.push({
          x: playerPos.x,
          z: playerPos.z,
          damage: this.stats.novaDamage,
          radius: this.stats.novaRadius,
        });
        this.novaFlash = 1;
      }
      this.novaFlash = Math.max(0, this.novaFlash - delta * 1.8);
      if (this.novaFlash > 0) {
        this.novaRing.visible = true;
        const t = 1 - this.novaFlash;
        this.novaRing.scale.setScalar(0.35 + t * this.stats.novaRadius * 0.65);
        this.novaMat.opacity = this.novaFlash * 0.28;
      } else {
        this.novaRing.visible = false;
      }
    }

    const turretState = this.owned.get('turret');
    if (turretState) {
      this.turretBody.rotation.y = -playerYaw;
      turretState.timer += delta;
      if (turretState.timer >= this.stats.turretCd) {
        let best: { x: number; z: number } | null = null;
        let bestDistSq = this.stats.turretRange * this.stats.turretRange;
        for (let ei = 0; ei < enemies.length; ei++) {
          const e = enemies[ei];
          const dx = e.x - playerPos.x;
          const dz = e.z - playerPos.z;
          const dSq = dx * dx + dz * dz;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            best = { x: e.x, z: e.z };
          }
        }
        if (best) {
          turretState.timer = 0;
          turretShots.push({
            x: playerPos.x + 0.42,
            z: playerPos.z + 0.16,
            damage: this.stats.turretDamage,
            tx: best.x,
            tz: best.z,
          });
        }
      }
    }

    return { orbitHits, missiles, novas, turretShots };
  }

  reset(): void {
    this.owned.clear();
    this.syncOrbitMeshes();
    this.turretBody.visible = false;
    this.novaRing.visible = false;
    this.angle = 0;
  }

  dispose(): void {
    this.orbitGeo.dispose();
    this.orbitMat.dispose();
    this.turretMat.dispose();
    this.novaMat.dispose();
    this.novaRing.geometry.dispose();
  }
}
