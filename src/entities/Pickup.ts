import * as THREE from 'three';
import { COLORS } from '../game/constants';

export type PickupKind = 'health' | 'shield' | 'rapid' | 'score';

export type Pickup = {
  group: THREE.Group;
  kind: PickupKind;
  active: boolean;
  life: number;
  bob: number;
};

const GEOMETRIES: Record<PickupKind, THREE.BufferGeometry> = {
  health: new THREE.OctahedronGeometry(0.38, 0),
  shield: new THREE.IcosahedronGeometry(0.38, 0),
  rapid: new THREE.TetrahedronGeometry(0.42, 0),
  score: new THREE.TorusKnotGeometry(0.22, 0.08, 48, 8),
};

const COLORS_MAP: Record<PickupKind, string> = {
  health: COLORS.health,
  shield: COLORS.shield,
  rapid: COLORS.rapid,
  score: COLORS.score,
};

export class PickupManager {
  readonly group = new THREE.Group();
  readonly pickups: Pickup[] = [];
  private readonly materials = new Map<PickupKind, THREE.MeshStandardMaterial>();

  constructor() {
    (Object.keys(COLORS_MAP) as PickupKind[]).forEach((kind) => {
      this.materials.set(
        kind,
        new THREE.MeshStandardMaterial({
          color: COLORS_MAP[kind],
          emissive: COLORS_MAP[kind],
          emissiveIntensity: 0.85,
          roughness: 0.25,
          metalness: 0.4,
        }),
      );
    });
  }

  spawn(kind: PickupKind, position: THREE.Vector3): void {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(GEOMETRIES[kind], this.materials.get(kind)!);
    mesh.castShadow = true;
    mesh.position.y = 0.85;
    group.add(mesh);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 24),
      new THREE.MeshBasicMaterial({
        color: COLORS_MAP[kind],
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.06;
    group.add(halo);

    group.position.copy(position);
    group.position.y = 0;
    this.group.add(group);
    this.pickups.push({
      group,
      kind,
      active: true,
      life: 18,
      bob: Math.random() * Math.PI * 2,
    });
  }

  update(delta: number, elapsed: number): void {
    for (const pickup of this.pickups) {
      if (!pickup.active) continue;
      pickup.life -= delta;
      if (pickup.life <= 0) {
        pickup.active = false;
        pickup.group.visible = false;
        continue;
      }
      pickup.group.rotation.y += delta * 1.6;
      pickup.group.position.y = Math.sin(elapsed * 2.5 + pickup.bob) * 0.12;
      const pulse = 1 + Math.sin(elapsed * 4 + pickup.bob) * 0.08;
      pickup.group.scale.setScalar(pulse);
    }
  }

  collect(pickup: Pickup): void {
    pickup.active = false;
    pickup.group.visible = false;
  }

  clear(): void {
    for (const pickup of this.pickups) {
      this.group.remove(pickup.group);
    }
    this.pickups.length = 0;
  }

  dispose(): void {
    this.clear();
    Object.values(GEOMETRIES).forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.material && !(mesh.material instanceof Array)) {
        // halo materials are unique per spawn; dispose leftovers
      }
    });
  }
}
